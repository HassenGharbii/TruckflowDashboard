import { Component } from "react";

export class ModelErrorBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    console.warn(
      "[camion] No usable 3D model found — using the built-in procedural truck instead.",
      error?.message || error
    );
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
