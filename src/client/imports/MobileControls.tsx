import {component, type Props, reactive, signal} from 'classy-solid'
import {createEffect, onCleanup, Show} from 'solid-js'
import type {FirstPersonCamera} from './FirstPersonCamera'
import type {Rifle} from './Rifle'

/**
 * On-screen touch controls for mobile:
 * - Left virtual joystick for movement
 * - Right side drag area for looking
 * - Fire button
 */
export
@component
@reactive
class MobileControls {
	PropTypes!: Props<Partial<this>, 'camera' | 'rifle' | 'visible'>

	@signal camera: FirstPersonCamera | null = null
	@signal rifle: Rifle | null = null
	@signal visible = true

	joystickBase!: HTMLDivElement
	joystickKnob!: HTMLDivElement
	lookArea!: HTMLDivElement
	fireBtn!: HTMLButtonElement

	// Joystick state
	activeJoystickId: number | null = null
	joyCenterX = 0
	joyCenterY = 0
	joyRadius = 50

	// Look touch
	activeLookId: number | null = null
	lastLookX = 0
	lastLookY = 0

	template = () => (
		<Show when={this.visible}>
			<div class="mobile-controls">
				{/* Left joystick */}
				<div
					class="joystick-zone"
					ref={this.joystickBase}
					onTouchStart={this.onJoyStart}
					onTouchMove={this.onJoyMove}
					onTouchEnd={this.onJoyEnd}
					onTouchCancel={this.onJoyEnd}
				>
					<div class="joystick-base">
						<div class="joystick-knob" ref={this.joystickKnob}></div>
					</div>
				</div>

				{/* Right look / fire zone */}
				<div
					class="look-zone"
					ref={this.lookArea}
					onTouchStart={this.onLookStart}
					onTouchMove={this.onLookMove}
					onTouchEnd={this.onLookEnd}
					onTouchCancel={this.onLookEnd}
				>
					<button
						class="fire-btn"
						ref={this.fireBtn}
						onTouchStart={e => {
							e.stopPropagation()
							this.fire()
						}}
						aria-label="Fire"
					>
						FIRE
					</button>
				</div>
			</div>
		</Show>
	)

	onMount() {
		// Prevent page scroll / zoom while playing
		const prevent = (e: TouchEvent) => {
			if ((e.target as HTMLElement)?.closest?.('.mobile-controls')) {
				e.preventDefault()
			}
		}
		document.addEventListener('touchmove', prevent, {passive: false})
		onCleanup(() => document.removeEventListener('touchmove', prevent))
	}

	onJoyStart = (e: TouchEvent) => {
		e.preventDefault()
		if (this.activeJoystickId !== null) return
		const t = e.changedTouches[0]
		this.activeJoystickId = t.identifier
		const rect = this.joystickBase.getBoundingClientRect()
		this.joyCenterX = rect.left + rect.width / 2
		this.joyCenterY = rect.top + rect.height / 2
		this.joyRadius = Math.min(rect.width, rect.height) * 0.35
		this.updateJoy(t.clientX, t.clientY)
	}

	onJoyMove = (e: TouchEvent) => {
		e.preventDefault()
		for (let i = 0; i < e.changedTouches.length; i++) {
			const t = e.changedTouches[i]
			if (t.identifier === this.activeJoystickId) {
				this.updateJoy(t.clientX, t.clientY)
				break
			}
		}
	}

	onJoyEnd = (e: TouchEvent) => {
		for (let i = 0; i < e.changedTouches.length; i++) {
			if (e.changedTouches[i].identifier === this.activeJoystickId) {
				this.activeJoystickId = null
				this.joystickKnob.style.transform = 'translate(-50%, -50%)'
				this.camera?.setMobileMove(0, 0)
				break
			}
		}
	}

	updateJoy(clientX: number, clientY: number) {
		let dx = clientX - this.joyCenterX
		let dy = clientY - this.joyCenterY
		const dist = Math.hypot(dx, dy)
		if (dist > this.joyRadius) {
			dx = (dx / dist) * this.joyRadius
			dy = (dy / dist) * this.joyRadius
		}
		this.joystickKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`
		// Normalize: x right positive, y forward (up) positive → invert dy
		const nx = dx / this.joyRadius
		const ny = -dy / this.joyRadius
		this.camera?.setMobileMove(nx, ny)
	}

	onLookStart = (e: TouchEvent) => {
		// Ignore if the touch started on the fire button
		if ((e.target as HTMLElement).closest('.fire-btn')) return
		e.preventDefault()
		if (this.activeLookId !== null) return
		const t = e.changedTouches[0]
		this.activeLookId = t.identifier
		this.lastLookX = t.clientX
		this.lastLookY = t.clientY
	}

	onLookMove = (e: TouchEvent) => {
		e.preventDefault()
		for (let i = 0; i < e.changedTouches.length; i++) {
			const t = e.changedTouches[i]
			if (t.identifier === this.activeLookId) {
				const dx = t.clientX - this.lastLookX
				const dy = t.clientY - this.lastLookY
				this.lastLookX = t.clientX
				this.lastLookY = t.clientY
				this.camera?.applyMobileLookDelta(dx, dy, 0.18)
				break
			}
		}
	}

	onLookEnd = (e: TouchEvent) => {
		for (let i = 0; i < e.changedTouches.length; i++) {
			if (e.changedTouches[i].identifier === this.activeLookId) {
				this.activeLookId = null
				break
			}
		}
	}

	fire() {
		this.rifle?.shoot()
	}
}
