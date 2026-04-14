<script lang="ts">
	interface Props {
		label: string;
		color: string;
	}

	let { label, color }: Props = $props();
</script>

<span class="pill" style="background: #{color}">
	{label}
</span>

<style>
	.pill {
		display: inline-flex;
		align-items: center;
		padding: 2px var(--space-sm);
		border-radius: var(--radius-full);
		font-weight: var(--weight-medium);
		font-size: var(--text-xs);
		color: #fff;
		white-space: nowrap;
	}
</style>
