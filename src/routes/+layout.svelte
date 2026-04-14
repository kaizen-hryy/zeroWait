<script lang="ts">
	import '../app.css';
	import { onNavigate } from '$app/navigation';
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
</script>

<svelte:head>
	<title>zeroWait</title>
	<link rel="icon" type="image/png" href="/icon.png" />
</svelte:head>

<div class="app-shell">
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
</style>
