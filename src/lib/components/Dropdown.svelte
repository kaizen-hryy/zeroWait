<script lang="ts">
	import { onMount } from 'svelte';

	interface Option {
		value: string;
		label: string;
		sublabel?: string;
	}

	interface Props {
		options: Option[];
		selected: string;
		onSelect: (value: string) => void;
	}

	let { options, selected, onSelect }: Props = $props();

	let open = $state(false);
	let dropdownEl: HTMLDivElement;

	let selectedOption = $derived(options.find((o) => o.value === selected) ?? options[0]);

	function toggle() {
		open = !open;
	}

	function select(value: string) {
		open = false;
		onSelect(value);
	}

	// Close on outside click
	onMount(() => {
		function handleClick(e: MouseEvent) {
			if (dropdownEl && !dropdownEl.contains(e.target as Node)) {
				open = false;
			}
		}
		document.addEventListener('click', handleClick, true);
		return () => document.removeEventListener('click', handleClick, true);
	});
</script>

<div class="dropdown" bind:this={dropdownEl}>
	<button class="trigger" onclick={toggle}>
		<div class="trigger-content">
			<span class="trigger-label">{selectedOption?.label ?? 'Select...'}</span>
			{#if selectedOption?.sublabel}
				<span class="trigger-sub">{selectedOption.sublabel}</span>
			{/if}
		</div>
		<span class="chevron" class:open>{@html '&#9662;'}</span>
	</button>

	{#if open}
		<div class="menu">
			{#each options as opt}
				<button
					class="menu-item"
					class:active={opt.value === selected}
					onclick={() => select(opt.value)}
				>
					<span class="item-label">{opt.label}</span>
					{#if opt.sublabel}
						<span class="item-sub">{opt.sublabel}</span>
					{/if}
					{#if opt.value === selected}
						<span class="check">{@html '&#10003;'}</span>
					{/if}
				</button>
			{/each}
		</div>
	{/if}
</div>

<style>
	.dropdown {
		position: relative;
	}

	.trigger {
		display: flex;
		align-items: center;
		justify-content: space-between;
		width: 100%;
		gap: var(--space-sm);
		background: var(--bg-card);
		border: 1px solid var(--border-default);
		border-radius: var(--radius-md);
		padding: var(--space-md) var(--space-lg);
		color: var(--text-primary);
		font-family: var(--font-sans);
		font-size: var(--text-sm);
		text-align: left;
		cursor: pointer;
		transition: border-color var(--transition-fast);
	}

	.trigger:hover { border-color: var(--accent); }

	.trigger-content {
		display: flex;
		align-items: baseline;
		gap: var(--space-sm);
		min-width: 0;
		overflow: hidden;
	}

	.trigger-label {
		font-weight: var(--weight-medium);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.trigger-sub {
		font-size: var(--text-xs);
		color: var(--text-muted);
		white-space: nowrap;
	}

	.chevron {
		font-size: var(--text-xs);
		color: var(--text-muted);
		transition: transform var(--transition-fast);
		flex-shrink: 0;
	}

	.chevron.open { transform: rotate(180deg); }

	.menu {
		position: absolute;
		top: calc(100% + var(--space-xs));
		left: 0;
		right: 0;
		background: var(--bg-card);
		border: 1px solid var(--border-default);
		border-radius: var(--radius-md);
		box-shadow: var(--shadow-elevated);
		z-index: 30;
		overflow: hidden;
	}

	.menu-item {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
		width: 100%;
		padding: var(--space-md) var(--space-lg);
		background: none;
		border: none;
		border-bottom: 1px solid var(--border-subtle);
		color: var(--text-primary);
		font-family: var(--font-sans);
		font-size: var(--text-sm);
		text-align: left;
		cursor: pointer;
		transition: background var(--transition-fast);
	}

	.menu-item:last-child { border-bottom: none; }
	.menu-item:hover { background: var(--accent-muted); }
	.menu-item.active { background: var(--bg-elevated); }

	.item-label {
		flex: 1;
		font-weight: var(--weight-medium);
	}

	.item-sub {
		font-size: var(--text-xs);
		color: var(--text-muted);
	}

	.check {
		font-size: var(--text-xs);
		color: var(--accent);
		flex-shrink: 0;
	}
</style>
