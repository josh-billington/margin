import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'

export class ErrorBoundary extends Component<
	{ children: ReactNode; message: string; className?: string },
	{ failed: boolean }
> {
	state = { failed: false }
	static getDerivedStateFromError() {
		return { failed: true }
	}
	componentDidCatch(error: Error, info: ErrorInfo) {
		console.error('Margin could not render a panel', error, info.componentStack)
	}
	render() {
		if (!this.state.failed) return this.props.children
		return (
			<div className={`render-error ${this.props.className ?? ''}`} role="alert">
				<p>{this.props.message}</p>
				<button type="button" className="button" onClick={() => this.setState({ failed: false })}>
					Try again
				</button>
			</div>
		)
	}
}
