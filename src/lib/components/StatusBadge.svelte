<script lang="ts">
	interface Props {
		status: 'safe' | 'warn' | 'urgent' | 'missed' | 'grace';
		label: string;
	}

	let { status, label }: Props = $props();
</script>

<span class="badge badge-{status}">{label}</span>

<style>
	.badge {
		display: inline-flex;
		align-items: center;
		gap: var(--space-sm);
		padding: var(--space-sm) var(--space-md);
		border-radius: var(--radius-full);
		font-size: var(--text-sm);
		font-weight: var(--weight-medium);
	}

	.badge::before {
		content: '';
		width: 8px;
		height: 8px;
		border-radius: var(--radius-full);
	}

	.badge-safe { background: var(--status-safe-bg); color: var(--status-safe); }
	.badge-safe::before { background: var(--status-safe); }
	.badge-warn { background: var(--status-warn-bg); color: var(--status-warn); }
	.badge-warn::before { background: var(--status-warn); }
	.badge-urgent { background: var(--status-urgent-bg); color: var(--status-urgent); }
	.badge-urgent::before { background: var(--status-urgent); }
	.badge-missed { background: var(--status-missed-bg); color: var(--status-missed); }
	.badge-missed::before { background: var(--status-missed); }
	.badge-grace { background: var(--status-grace-bg); color: var(--status-grace); }
	.badge-grace::before { background: var(--status-grace); animation: pulse 1s ease-in-out infinite; }

	@keyframes pulse {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.4; }
	}
</style>
