<script lang="ts">
	import type { Departure } from '$lib/types';

	interface Props {
		routeLabel: string;
		routeColor: string;
		departure: Departure | null;
		minutesUntilLeave: number | null;
	}

	let { routeLabel, routeColor, departure, minutesUntilLeave }: Props = $props();

	let countdownColor = $derived.by(() => {
		if (minutesUntilLeave === null || minutesUntilLeave <= 0) return 'var(--status-missed)';
		if (minutesUntilLeave <= 3) return 'var(--status-urgent)';
		if (minutesUntilLeave <= 10) return 'var(--status-warn)';
		return 'var(--status-safe)';
	});

	function formatTime(time: string): string {
		const [h, m] = time.split(':');
		const hour = parseInt(h, 10) % 24;
		const ampm = hour >= 12 ? 'PM' : 'AM';
		const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
		return `${h12}:${m} ${ampm}`;
	}
</script>

<div class="compact-card">
	<div class="line" style="background: #{routeColor}"></div>
	<div class="content">
		<div class="top">
			<span class="route">{routeLabel}</span>
			<span class="countdown" style="color: {countdownColor}">
				{minutesUntilLeave !== null && minutesUntilLeave >= 0 ? `${minutesUntilLeave} min` : '--'}
			</span>
		</div>
		{#if departure}
			<div class="detail">
				Leave by {formatTime(departure.leaveByTime ?? '')} &middot; Departs {formatTime(departure.departureTime)}
			</div>
		{:else}
			<div class="detail">No departures</div>
		{/if}
	</div>
</div>

<style>
	.compact-card {
		background: var(--bg-card);
		border: 1px solid var(--border-default);
		border-radius: var(--radius-lg);
		padding: var(--space-lg);
		display: flex;
		align-items: center;
		gap: var(--space-lg);
		box-shadow: var(--shadow-card);
	}

	.line {
		width: 4px;
		height: 48px;
		border-radius: var(--radius-full);
		flex-shrink: 0;
	}

	.content { flex: 1; min-width: 0; }

	.top {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		margin-bottom: 2px;
	}

	.route {
		font-size: var(--text-sm);
		font-weight: var(--weight-medium);
	}

	.countdown {
		font-family: var(--font-mono);
		font-size: var(--text-sm);
		font-weight: var(--weight-semibold);
	}

	.detail {
		font-size: var(--text-xs);
		color: var(--text-muted);
	}
</style>
