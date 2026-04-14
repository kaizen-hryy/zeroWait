<script lang="ts">
	import '../app.css';
	import { onNavigate, invalidateAll } from '$app/navigation';
	import { onMount } from 'svelte';
	import MenuSheet from '$lib/components/MenuSheet.svelte';
	import type { Snippet } from 'svelte';

	let { children }: { children: Snippet } = $props();

	let menuOpen = $state(false);

	// Page transitions using View Transitions API
	onNavigate((navigation) => {
		if (!document.startViewTransition) return;

		return new Promise((resolve) => {
			document.startViewTransition(async () => {
				resolve();
				await navigation.complete;
			});
		});
	});

	// Pull-to-refresh — direct DOM manipulation for 60fps
	let indicatorEl: HTMLDivElement;
	let shellEl: HTMLDivElement;

	onMount(() => {
		const THRESHOLD = 80;
		const MAX_PULL = 120;
		let startY = 0;
		let tracking = false; // tracking touch, not yet pulling
		let active = false;  // actively pulling (at top + dragging down)
		let busy = false;

		function onTouchStart(e: TouchEvent) {
			if (busy) return;
			startY = e.touches[0].clientY;
			tracking = true;
			active = false;
		}

		function onTouchMove(e: TouchEvent) {
			if (!tracking || busy) return;

			const currentY = e.touches[0].clientY;

			// Activate pull mode when user is at scroll top and dragging down
			if (!active) {
				if (window.scrollY <= 0 && currentY > startY) {
					active = true;
					startY = currentY; // reset origin to where pull begins
				} else {
					return;
				}
			}

			const dy = currentY - startY;
			if (dy <= 0) {
				setIndicator(0);
				return;
			}

			// Damped pull with diminishing returns
			const pull = Math.min(dy * 0.4, MAX_PULL);
			setIndicator(pull);
		}

		async function onTouchEnd() {
			if (!active || busy) {
				tracking = false;
				active = false;
				return;
			}

			const pull = getCurrentPull();
			tracking = false;
			active = false;

			if (pull >= THRESHOLD) {
				busy = true;
				setRefreshing(true);
				await invalidateAll();
				setRefreshing(false);
				busy = false;
			}

			animateOut();
		}

		// Direct DOM updates — no Svelte reactivity in the hot path
		function setIndicator(pull: number) {
			const progress = Math.min(pull / THRESHOLD, 1);
			indicatorEl.style.transform = `translateY(${pull - 40}px)`;
			indicatorEl.style.opacity = String(progress);
			const icon = indicatorEl.querySelector('.pull-icon') as HTMLElement;
			if (icon) {
				// Rotate arrow to refresh icon as user pulls
				icon.style.transform = `rotate(${progress * 180}deg)`;
			}
			if (pull >= THRESHOLD) {
				indicatorEl.classList.add('ready');
			} else {
				indicatorEl.classList.remove('ready');
			}
			// Shift content down
			shellEl.style.transform = `translateY(${pull}px)`;
		}

		function setRefreshing(on: boolean) {
			if (on) {
				indicatorEl.classList.add('refreshing');
				indicatorEl.style.transform = 'translateY(40px)';
				indicatorEl.style.opacity = '1';
				shellEl.style.transform = 'translateY(80px)';
			} else {
				indicatorEl.classList.remove('refreshing');
			}
		}

		function getCurrentPull(): number {
			const t = shellEl.style.transform;
			const m = t.match(/translateY\((.+?)px\)/);
			return m ? parseFloat(m[1]) : 0;
		}

		function animateOut() {
			shellEl.style.transition = 'transform 0.25s cubic-bezier(0.2, 0, 0, 1)';
			indicatorEl.style.transition = 'transform 0.25s cubic-bezier(0.2, 0, 0, 1), opacity 0.2s ease';
			shellEl.style.transform = 'translateY(0)';
			indicatorEl.style.transform = 'translateY(-40px)';
			indicatorEl.style.opacity = '0';
			indicatorEl.classList.remove('ready');

			const cleanup = () => {
				shellEl.style.transition = '';
				indicatorEl.style.transition = '';
			};
			shellEl.addEventListener('transitionend', cleanup, { once: true });
			// Fallback in case transitionend doesn't fire
			setTimeout(cleanup, 300);
		}

		document.addEventListener('touchstart', onTouchStart, { passive: true });
		document.addEventListener('touchmove', onTouchMove, { passive: true });
		document.addEventListener('touchend', onTouchEnd);

		return () => {
			document.removeEventListener('touchstart', onTouchStart);
			document.removeEventListener('touchmove', onTouchMove);
			document.removeEventListener('touchend', onTouchEnd);
		};
	});
</script>

<svelte:head>
	<title>zeroWait</title>
	<link rel="icon" type="image/png" href="/icon.png" />
</svelte:head>

<div class="pull-indicator" bind:this={indicatorEl}>
	<span class="pull-icon">&#8635;</span>
</div>

<div class="app-shell" bind:this={shellEl}>
	<header class="top-bar">
		<button class="menu-btn" onclick={() => { menuOpen = true; }} aria-label="Menu">
			<span class="menu-icon">&#9776;</span>
		</button>
		<div class="logo-group">
			<img src="/icon.png" alt="zeroWait" class="logo-icon" />
			<h1 class="logo">zeroWait</h1>
		</div>
		<div class="spacer"></div>
	</header>

	<main class="content">
		{@render children()}
	</main>
</div>

<MenuSheet open={menuOpen} onClose={() => { menuOpen = false; }} />

<style>
	.app-shell {
		max-width: 420px;
		margin: 0 auto;
		min-height: 100dvh;
	}

	.top-bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: var(--space-lg);
		position: relative;
	}

	.logo-group {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
		position: absolute;
		left: 50%;
		transform: translateX(-50%);
	}

	.logo-icon {
		width: 28px;
		height: 28px;
		border-radius: var(--radius-sm);
	}

	.logo {
		font-size: var(--text-lg);
		font-weight: var(--weight-bold);
		letter-spacing: -0.02em;
	}

	.spacer {
		width: 36px;
	}

	.menu-btn {
		background: var(--bg-card);
		border: 1px solid var(--border-default);
		border-radius: var(--radius-full);
		padding: var(--space-sm) var(--space-md);
		color: var(--text-secondary);
		font-size: var(--text-lg);
		transition: background var(--transition-fast);
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.menu-btn:hover { background: var(--bg-elevated); }

	.menu-icon { line-height: 1; }

	.content {
		padding: var(--space-sm) var(--space-lg) var(--space-lg);
	}

	:global(.pull-indicator) {
		position: fixed;
		top: 0;
		left: 50%;
		margin-left: -18px;
		width: 36px;
		height: 36px;
		border-radius: var(--radius-full);
		background: var(--bg-card);
		border: 1px solid var(--border-default);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 100;
		transform: translateY(-40px);
		opacity: 0;
		will-change: transform, opacity;
		box-shadow: var(--shadow-elevated);
	}

	:global(.pull-indicator.ready) {
		border-color: var(--accent);
	}

	:global(.pull-indicator.refreshing) .pull-icon {
		animation: spin 0.6s linear infinite;
	}

	:global(.pull-indicator.ready) .pull-icon {
		color: var(--accent);
	}

	.pull-icon {
		font-size: var(--text-lg);
		color: var(--text-muted);
		line-height: 1;
		will-change: transform;
	}

	.app-shell {
		will-change: transform;
	}

	@keyframes spin {
		from { transform: rotate(0deg); }
		to { transform: rotate(360deg); }
	}
</style>
