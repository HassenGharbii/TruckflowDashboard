# Run this ON THE TRUCKFLOW MACHINE (same place the earlier scripts worked).
# Uses the SAME Windows Authentication that already connected successfully,
# to:
#   1. Create a NEW, separate, read-only SQL login (does NOT touch
#      PMTruckflowUser or the app's own credentials in any way).
#   2. Grant it SELECT-only access (db_datareader) on TruckFlowDB.
#   3. Report whether this SQL Server instance currently accepts TCP
#      connections (needed to query it from a DIFFERENT machine) and print
#      this machine's IP addresses to use from that other machine.
#
# READ-ONLY to the app's own data: it only creates one new login/user and
# reads diagnostic info. It never modifies TruckFlowDB's data or schema.
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File windows-truckflow-setup-readonly-login.ps1

$ErrorActionPreference = "Stop"

$server = "localhost\PMSQLSERVER"
$database = "TruckFlowDB"
$loginName = "DashboardReadOnly"

Add-Type -AssemblyName "System.Data"

Write-Host "=== Connecting with Windows Authentication ===" -ForegroundColor Cyan
$connString = "Server=$server;Database=master;Integrated Security=True;TrustServerCertificate=True;Connection Timeout=5"
try {
    $conn = New-Object System.Data.SqlClient.SqlConnection($connString)
    $conn.Open()
    Write-Host "CONNECTED." -ForegroundColor Green
} catch {
    Write-Host "Failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

function Invoke-Sql($connection, $queryText) {
    $cmd = $connection.CreateCommand()
    $cmd.CommandText = $queryText
    return $cmd.ExecuteNonQuery()
}

function Invoke-SqlScalar($connection, $queryText) {
    $cmd = $connection.CreateCommand()
    $cmd.CommandText = $queryText
    return $cmd.ExecuteScalar()
}

Write-Host "`n=== Checking current permissions ===" -ForegroundColor Cyan
$isSysadmin = Invoke-SqlScalar $conn "SELECT IS_SRVROLEMEMBER('sysadmin')"
if ($isSysadmin -eq 1) {
    Write-Host "Current account is sysadmin on this SQL Server instance. Good." -ForegroundColor Green
} else {
    Write-Host "Current account is NOT sysadmin. CREATE LOGIN may fail below." -ForegroundColor Yellow
    Write-Host "If it does, ask whoever manages this SQL Server to run this script, or to" -ForegroundColor Yellow
    Write-Host "create the login manually (see instructions printed at the end)." -ForegroundColor Yellow
}

Write-Host "`n=== Enter a password for the new read-only login ===" -ForegroundColor Cyan
Write-Host "Choose it yourself now - write it down, it will be needed in the dashboard's .env file." -ForegroundColor Cyan
$securePass = Read-Host "New password for '$loginName'" -AsSecureString
$plainPass = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto(
    [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePass)
)
$escapedPass = $plainPass.Replace("'", "''")

Write-Host "`n=== Creating login and read-only user ===" -ForegroundColor Cyan
try {
    $loginExists = Invoke-SqlScalar $conn "SELECT COUNT(*) FROM sys.server_principals WHERE name = '$loginName'"
    if ($loginExists -eq 0) {
        Invoke-Sql $conn "CREATE LOGIN [$loginName] WITH PASSWORD = '$escapedPass', CHECK_POLICY = OFF" | Out-Null
        Write-Host "Created server login '$loginName'." -ForegroundColor Green
    } else {
        Invoke-Sql $conn "ALTER LOGIN [$loginName] WITH PASSWORD = '$escapedPass'" | Out-Null
        Write-Host "Login '$loginName' already existed - password updated." -ForegroundColor Green
    }

    $conn.ChangeDatabase($database)
    $userExists = Invoke-SqlScalar $conn "SELECT COUNT(*) FROM sys.database_principals WHERE name = '$loginName'"
    if ($userExists -eq 0) {
        Invoke-Sql $conn "CREATE USER [$loginName] FOR LOGIN [$loginName]" | Out-Null
        Write-Host "Created database user in $database." -ForegroundColor Green
    }
    Invoke-Sql $conn "ALTER ROLE db_datareader ADD MEMBER [$loginName]" | Out-Null
    Write-Host "Granted read-only (db_datareader) access on $database." -ForegroundColor Green
} catch {
    Write-Host "Failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "See the sysadmin check above - this account likely lacks permission." -ForegroundColor Yellow
    exit 1
}

Write-Host "`n=== Checking if this instance accepts remote (TCP) connections ===" -ForegroundColor Cyan
$portInfo = Invoke-SqlScalar $conn "SELECT local_tcp_port FROM sys.dm_exec_connections WHERE session_id = @@SPID"
if ($portInfo) {
    Write-Host "TCP/IP is active. This connection came in on TCP port: $portInfo" -ForegroundColor Green
    Write-Host "That port must also be allowed through Windows Firewall for a remote machine to reach it." -ForegroundColor Yellow
} else {
    Write-Host "This connection used Shared Memory, not TCP/IP." -ForegroundColor Yellow
    Write-Host "That means TCP/IP may not be enabled for remote connections yet." -ForegroundColor Yellow
    Write-Host "To fix: open 'SQL Server Configuration Manager' on this machine ->" -ForegroundColor Yellow
    Write-Host "  SQL Server Network Configuration -> Protocols for PMSQLSERVER ->" -ForegroundColor Yellow
    Write-Host "  enable 'TCP/IP' -> restart the 'SQL Server (PMSQLSERVER)' service." -ForegroundColor Yellow
    Write-Host "Then re-run this script to confirm a TCP port shows up." -ForegroundColor Yellow
}

Write-Host "`n=== This machine's network addresses (use one of these as TRUCKFLOW_DB_HOST) ===" -ForegroundColor Cyan
Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.254.*" } |
    Select-Object IPAddress, InterfaceAlias | Format-Table -AutoSize

$conn.Close()

Write-Host "`n=== Done ===" -ForegroundColor Cyan
Write-Host "On the OTHER machine (where the dashboard server runs), set in server/.env:" -ForegroundColor Cyan
Write-Host "  DATA_SOURCE=truckflow"
Write-Host "  TRUCKFLOW_DB_HOST=<one of the IPs printed above>"
Write-Host "  TRUCKFLOW_DB_INSTANCE=PMSQLSERVER"
Write-Host "  TRUCKFLOW_DB_USER=$loginName"
Write-Host "  TRUCKFLOW_DB_PASSWORD=<the password you just typed in>"
Write-Host "If the TCP/IP check above said it was NOT active, follow the Configuration" -ForegroundColor Yellow
Write-Host "Manager steps printed above first, and open the reported port in Windows Firewall." -ForegroundColor Yellow
