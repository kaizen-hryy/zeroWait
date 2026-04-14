<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { fly, fade } from 'svelte/transition';

	interface Props {
		open: boolean;
		onClose: () => void;
	}

	let { open, onClose }: Props = $props();

	const menuItems = [
		{ href: '/', label: 'Dashboard' },
		{ href: '/profiles', label: 'Profiles' },
		{ href: '/settings', label: 'Settings' }
	];

	function isActive(href: string): boolean {
		if (href === '/') return page.url.pathname === '/';
		return page.url.pathname.startsWith(href);
	}

	function navigate(href: string) {
		onClose();
		// Small delay to let the sheet animate out before navigating
		setTimeout(() => {
			goto(href);
		}, 150);
	}
</script>

{#if open}
	<!-- Backdrop -->
	<button
		class="backdrop"
		onclick={onClose}
		aria-label="Close menu"
		transition:fade={{ duration: 200 }}
	></button>

	<!-- Sheet -->
	<nav class="sheet" transition:fly={{ y: 300, duration: 250, easing: (t) => 1 - Math.pow(1 - t, 3) }}>
		<div class="handle"></div>
		{#each menuItems as item}
			<button
				class="sheet-item"
				class:active={isActive(item.href)}
				onclick={() => navigate(item.href)}
			>
				<span class="item-label">{item.label}</span>
				{#if isActive(item.href)}
					<span class="item-indicator"></span>
				{/if}
			</button>
		{/each}
		<div class="divider"></div>
		<button class="sheet-item cancel" onclick={onClose}>Cancel</button>
	</nav>
{/if}

<style>
	.backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.5);
		z-index: 90;
		border: none;
		cursor: default;
		-webkit-backdrop-filter: blur(4px);
		backdrop-filter: blur(4px);
	}

	.sheet {
		position: fixed;
		bottom: 0;
		left: 0;
		right: 0;
		background: var(--bg-card);
		border-top: 1px solid var(--border-default);
		border-radius: var(--radius-xl) var(--radius-xl) 0 0;
		padding: var(--space-sm) 0 0;
		padding-bottom: max(var(--space-lg), env(safe-area-inset-bottom));
		z-index: 100;
	}

	.handle {
		width: 36px;
		height: 4px;
		background: var(--border-default);
		border-radius: var(--radius-full);
		margin: 0 auto var(--space-md);
	}

	.sheet-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		width: 100%;
		padding: var(--space-lg) var(--space-xl);
		font-family: var(--font-sans);
		font-size: var(--text-base);
		font-weight: var(--weight-medium);
		color: var(--text-primary);
		text-decoration: none;
		background: none;
		border: none;
		cursor: pointer;
		transition: background var(--transition-fast);
	}

	.sheet-item:hover { background: var(--accent-muted); }
	.sheet-item.active { color: var(--accent); }

	.item-label { flex: 1; text-align: left; }

	.item-indicator {
		width: 6px;
		height: 6px;
		border-radius: var(--radius-full);
		background: var(--accent);
	}

	.divider {
		height: 1px;
		background: var(--border-default);
		margin: var(--space-sm) var(--space-xl);
	}

	.cancel {
		color: var(--text-muted);
	}

	.cancel .item-label { text-align: center; }
</style>
