import {component, type Props, reactive, signal} from 'classy-solid'
import createThrottle from '@solid-primitives/throttle'
import {clamp, Motor, Element3D, toRadians, XYZNumberValues, PerspectiveCamera} from 'lume'
import {Raycaster} from 'three'
import {createEffect, onCleanup, JSX, batch} from 'solid-js'
import {render} from 'solid-js/web'
import {Vector2} from 'three/src/math/Vector2'

const caster = new Raycaster()

/** Detect coarse pointer / touch devices */
function isTouchDevice() {
	return (
		(typeof window !== 'undefined' &&
			('ontouchstart' in window ||
				(navigator as any).maxTouchPoints > 0 ||
				window.matchMedia('(pointer: coarse)').matches)) ||
		false
	)
}

export
@component
@reactive
class FirstPersonCamera {
	PropTypes!: Props<
		Partial<this>,
		| 'instance'
		| 'onPlayerMove'
		| 'crouchAmount'
		| 'elementsToIntersect'
		| 'onIntersect'
		| 'autoIntersect'
		| 'enableMobileControls'
	>

	@signal instance: ((i: this) => void) | null = null

	@signal onPlayerMove:
		| ((pos: {x: number; y: number; z: number; rx: number; ry: number; crouch: boolean}) => void)
		| null = null

	crouchAmount = 0

	@signal elementsToIntersect: Set<Element3D> | null = null

	@signal intersectedElements: Element3D[] = []

	@signal onIntersect: ((n: Element3D[]) => void) | null = null

	@signal autoIntersect = true

	/** When true (default on touch devices) use on-screen joystick + touch-look instead of pointer-lock. */
	@signal enableMobileControls = isTouchDevice()

	camRotation = new XYZNumberValues()
	camPosition = new XYZNumberValues()

	@signal __crouchAmount = this.crouchAmount

	root!: Element3D
	camera!: PerspectiveCamera

	// Mobile movement state (normalized -1..1)
	mobileMoveX = 0
	mobileMoveY = 0

	template = (props: this['PropTypes']) => (
		<lume-element3d
			ref={this.root}
			rotation={new XYZNumberValues([0, this.camRotation.y])}
			position={new XYZNumberValues([this.camPosition.x, this.camPosition.y, this.camPosition.z])}
			use:shadow={
				<>
					<slot></slot>

					<lume-perspective-camera
						ref={this.camera}
						active
						rotation={new XYZNumberValues([this.camRotation.x])}
						far="200000"
						zoom={1}
					>
						<slot name="camera-child"></slot>
					</lume-perspective-camera>
				</>
			}
		>
			{props.children}
		</lume-element3d>
	)

	__playerMove() {
		const {x, y, z} = this.camPosition
		const {x: rx, y: ry} = this.camRotation
		const crouch = !!this.__crouchAmount
		this.onPlayerMove?.({x, y, z, rx, ry, crouch})
	}

	/** Called by external mobile joystick UI */
	setMobileMove(x: number, y: number) {
		this.mobileMoveX = clamp(x, -1, 1)
		this.mobileMoveY = clamp(y, -1, 1)
	}

	/** Called by external look-area / touch handlers */
	applyMobileLookDelta(dx: number, dy: number, sensitivity = 0.15) {
		this.camRotation.y -= dx * sensitivity
		this.camRotation.x = clamp(this.camRotation.x + dy * sensitivity, -90, 90)
		this.__playerMove()
	}

	onMount() {
		queueMicrotask(() => this.instance?.(this))

		createEffect(() => (this.camPosition.y = this.__crouchAmount))

		const moveSpeed = 1

		// ---------- Desktop pointer-lock look ----------
		createEffect(() => {
			if (this.enableMobileControls) return // skip on mobile

			const scene = this.root.scene
			if (!scene) return

			const onmove = (e: PointerEvent) => {
				this.camRotation.y -= e.movementX * 0.1
				this.camRotation.x = clamp(this.camRotation.x + e.movementY * 0.1, -90, 90)
				this.__playerMove()
			}

			const onlockchange = () => {
				if (!document.pointerLockElement) scene.removeEventListener('pointermove', onmove)
			}

			const onclick = () => {
				if (document.pointerLockElement) return
				scene.requestPointerLock()
				scene.addEventListener('pointermove', onmove)
				document.addEventListener('pointerlockchange', onlockchange)
			}

			scene.addEventListener('click', onclick)

			onCleanup(() => {
				scene.removeEventListener('click', onclick)
				scene.removeEventListener('pointermove', onmove)
				document.removeEventListener('pointerlockchange', onlockchange)
			})
		})

		// ---------- Desktop keyboard movement ----------
		createEffect(() => {
			if (this.enableMobileControls) return

			const keysDown = {w: false, a: false, s: false, d: false}

			for (const key of ['w', 'a', 's', 'd'] as const) {
				const onKeyDown = (e: KeyboardEvent) => {
					if (!document.pointerLockElement) return
					if (key != e.key.toLowerCase()) return
					if (keysDown[key]) return

					keysDown[key] = true

					let nextPositionZ = (_dt: number) => 0
					let nextPositionY = (_dt: number) => 0

					if (key === 'w') {
						nextPositionZ = dt => -Math.cos(toRadians(this.camRotation.y)) * moveSpeed * dt
						nextPositionY = dt => -Math.sin(toRadians(this.camRotation.y)) * moveSpeed * dt
					}
					if (key === 'a') {
						nextPositionZ = dt => Math.sin(toRadians(this.camRotation.y)) * moveSpeed * dt
						nextPositionY = dt => -Math.cos(toRadians(this.camRotation.y)) * moveSpeed * dt
					}
					if (key === 's') {
						nextPositionZ = dt => Math.cos(toRadians(this.camRotation.y)) * moveSpeed * dt
						nextPositionY = dt => Math.sin(toRadians(this.camRotation.y)) * moveSpeed * dt
					}
					if (key === 'd') {
						nextPositionZ = dt => -Math.sin(toRadians(this.camRotation.y)) * moveSpeed * dt
						nextPositionY = dt => Math.cos(toRadians(this.camRotation.y)) * moveSpeed * dt
					}

					Motor.addRenderTask((_t, dt) => {
						this.camPosition.z += nextPositionZ(dt)
						this.camPosition.x += nextPositionY(dt)
						this.__playerMove()
						return keysDown[key]
					})
				}

				const onKeyUp = (e: KeyboardEvent) => {
					if (key != e.key.toLowerCase()) return
					keysDown[key] = false
				}

				window.addEventListener('keydown', onKeyDown)
				window.addEventListener('keyup', onKeyUp)

				onCleanup(() => {
					window.removeEventListener('keydown', onKeyDown)
					window.removeEventListener('keyup', onKeyUp)
				})
			}

			let crouched = false
			const onShiftDown = (e: KeyboardEvent) => {
				if (!document.pointerLockElement) return
				if (e.key != 'Shift') return
				if (crouched) return
				crouched = true
				this.__crouchAmount = this.crouchAmount
				this.__playerMove()
			}
			const onShiftUp = (e: KeyboardEvent) => {
				if (e.key != 'Shift') return
				crouched = false
				this.__crouchAmount = 0
				this.__playerMove()
			}
			window.addEventListener('keydown', onShiftDown)
			window.addEventListener('keyup', onShiftUp)
			onCleanup(() => {
				window.removeEventListener('keydown', onShiftDown)
				window.removeEventListener('keyup', onShiftUp)
			})
		})

		// ---------- Mobile continuous movement from joystick ----------
		createEffect(() => {
			if (!this.enableMobileControls) return

			Motor.addRenderTask((_t, dt) => {
				const mx = this.mobileMoveX
				const my = this.mobileMoveY
				if (mx === 0 && my === 0) return true // keep running

				const yaw = toRadians(this.camRotation.y)
				// Forward/back (my) and strafe (mx)
				const forwardZ = -Math.cos(yaw) * my * moveSpeed * dt
				const forwardX = -Math.sin(yaw) * my * moveSpeed * dt
				const strafeZ = Math.sin(yaw) * mx * moveSpeed * dt
				const strafeX = -Math.cos(yaw) * mx * moveSpeed * dt

				this.camPosition.z += forwardZ + strafeZ
				this.camPosition.x += forwardX + strafeX
				this.__playerMove()
				return true // keep the task alive
			})
		})

		// ---------- Auto-intersect ----------
		createEffect(() => {
			if (!this.autoIntersect) return

			const {x: _x, y: _y, z: _z} = this.camPosition
			const {x: _rx, y: _ry} = this.camRotation
			this.__crouchAmount
			this.elementsToIntersect

			this.throttledIntersect[0]()
		})
	}

	intersectDeferred = false

	throttledIntersect = createThrottle(() => {
		if (this.intersectDeferred) return
		this.intersectDeferred = true

		Motor.once(async () => {
			await Promise.resolve()
			await Promise.resolve()

			this.intersectDeferred = false

			caster.setFromCamera(new Vector2(0, 0), this.camera!.three)

			if (!this.elementsToIntersect) return

			const intersections = caster.intersectObjects(
				Array.from(this.elementsToIntersect)
					.map(el => el?.three)
					.filter(o => !!o),
			)

			batch(() => {
				this.intersectedElements = []

				for (const i of intersections) {
					for (const el of this.elementsToIntersect!) {
						if (!el) continue
						el.three.traverse(o => {
							if (i.object === o) {
								this.intersectedElements.push(el)
							}
						})
					}
				}

				this.onIntersect?.(this.intersectedElements)
			})
		})
	}, 50)

	intersect() {
		this.throttledIntersect[0]()
	}
}

async function shadow(el: Element, args: () => JSX.Element | [JSX.Element, ShadowRootInit] | true) {
	const _args = args()
	const [shadowChildren, shadowOptions = {mode: 'open'}] =
		_args === true
			? [() => <></>]
			: isShadowArgTuple(_args)
			? _args
			: [() => _args]

	await Promise.resolve()

	if (el.tagName.includes('-') && !customElements.get(el.tagName.toLowerCase())) {
		await Promise.race([
			new Promise<void>(resolve =>
				setTimeout(() => {
					console.warn(
						'Custom element is not defined after 1 second, skipping. Overriden attachShadow methods may break if the element is defined later.',
					)
					resolve()
				}, 1000),
			),
			customElements.whenDefined(el.tagName.toLowerCase()),
		])
	}

	const root = el.attachShadow(shadowOptions)
	// @ts-ignore
	render(shadowChildren, root)
}

declare module 'solid-js' {
	namespace JSX {
		interface CustomAttributes<T> {
			'use:shadow'?: JSX.Element | typeof shadow
		}
	}
}

function isShadowArgTuple(a: any): a is [JSX.Element, ShadowRootInit] {
	if (Array.isArray(a) && a.length === 2 && 'mode' in a[1]) return true
	return false
}
