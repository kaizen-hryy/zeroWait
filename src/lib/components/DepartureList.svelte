<script lang="ts">
	import type { Departure } from '$lib/types';

	interface Props {
		departures: Departure[];
		currentTimeSeconds: number;
		selectedDepartureIndex?: number;
		onSelect?: (index: number) => void;
	}

	let { departures, currentTimeSeconds, selectedDepartureIndex = 0, onSelect }: Props = $props();

	function timeToSeconds(time: string): number {
		const [h, m, s] = time.split(':').map(Number);
		return h * 3600 + m * 60 + (s || 0);
	}

	function minutesUntil(time: string): number {
		return Math.floor((timeToSeconds(time) - currentTimeSeconds) / 60);
	}

	function formatTime(time: string): string {
		return time.substring(0, 5);
	}
</script>

<div class="departure-list">
	{#each departures as dep, i}
		{@const isGrace = dep.grace}
		{@const isSelected = i === selectedDepartureIndex}
		{@const leaveMin = dep.leaveByTime ? minutesUntil(dep.leaveByTime) : null}
		<button
			class="departure-item"
			class:selected={isSelected}
			class:grace={isGrace}
			onclick={() => onSelect?.(i)}
		>
			<div class="left">
				<span class="dep-time" class:selected-text={isSelected && !isGrace} class:grace-text={isGrace}>{formatTime(dep.departureTime)}</span>
				{#if isGrace}
					<span class="leave-by grace-label">{Math.abs(leaveMin ?? 0)} min past leave-by</span>
				{:else}
					<span class="leave-by">Leave by {formatTime(dep.leaveByTime ?? '--:--')}</span>
				{/if}
				{#if dep.delayMinutes !== null && dep.delayMinutes !== undefined}
					{#if dep.delayMinutes > 1}
						<span class="eta-badge late">~{dep.delayMinutes} min late</span>
					{:else if dep.delayMinutes < -1}
						<span class="eta-badge early">~{Math.abs(dep.delayMinutes)} min early</span>
					{:else}
						<span class="eta-badge ontime">On time</span>
					{/if}
				{/if}
			</div>
			<div class="right">
				{#if isGrace}
					<div class="countdown grace-text">Might make it</div>
				{:else}
					<div class="countdown" class:selected-text={isSelected && !isGrace}>
						{leaveMin !== null && leaveMin >= 0 ? `${leaveMin} min` : '--'}
					</div>
				{/if}
				{#if isSelected && !isGrace}
					<div class="label">Selected</div>
				{/if}
				{#if dep.confirmed === true}
					<div class="vehicle-info">
						{#if dep.vehicleId}
							<span class="plate">{dep.vehicleId}</span>
						{/if}
						<div class="confirmed-dot" title="Bus confirmed"></div>
					</div>
				{:else if dep.confirmed === false}
					<div class="unconfirmed-dot" title="Unconfirmed"></div>
				{/if}
			</div>
		</button>
	{/each}
</div>

<style>
	.departure-list {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
	}

	.departure-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: var(--space-md) var(--space-lg);
		background: var(--bg-card);
		border: 1px solid var(--border-default);
		border-radius: var(--radius-md);
		width: 100%;
		text-align: left;
		font-family: var(--font-sans);
		color: var(--text-primary);
		cursor: pointer;
		transition: border-color var(--transition-fast), background var(--transition-fast);
	}

	.departure-item:hover {
		border-color: var(--accent);
	}

	.departure-item.selected {
		border-color: var(--status-safe);
		background: var(--status-safe-bg);
	}

	.departure-item.grace {
		border-color: var(--status-grace);
		background: var(--status-grace-bg);
		border-style: dashed;
	}

	.departure-item.grace.selected {
		border-color: var(--status-grace);
		border-style: solid;
		border-width: 2px;
	}

	.left { display: flex; flex-direction: column; gap: 2px; }

	.dep-time {
		font-family: var(--font-mono);
		font-size: var(--text-base);
		font-weight: var(--weight-semibold);
	}

	.leave-by {
		font-size: var(--text-xs);
		color: var(--text-muted);
	}

	.eta-badge {
		font-size: 10px;
		font-weight: var(--weight-medium);
		padding: 1px var(--space-xs);
		border-radius: var(--radius-sm);
	}

	.eta-badge.late { color: var(--status-urgent); background: var(--status-urgent-bg); }
	.eta-badge.early { color: var(--status-safe); background: var(--status-safe-bg); }
	.eta-badge.ontime { color: var(--status-safe); background: var(--status-safe-bg); }

	.right { text-align: right; display: flex; flex-direction: column; align-items: flex-end; gap: 2px; }

	.countdown {
		font-family: var(--font-mono);
		font-size: var(--text-sm);
		font-weight: var(--weight-semibold);
	}

	.selected-text { color: var(--status-safe); }
	.grace-text { color: var(--status-grace); }
	.grace-label { color: var(--status-grace); font-style: italic; }

	.label {
		font-size: var(--text-xs);
		color: var(--text-muted);
	}

	.vehicle-info {
		display: flex;
		align-items: center;
		gap: var(--space-xs);
	}

	.plate {
		font-family: var(--font-mono);
		font-size: 10px;
		color: var(--status-safe);
		background: var(--status-safe-bg);
		padding: 1px var(--space-xs);
		border-radius: var(--radius-sm);
	}

	.confirmed-dot {
		width: 6px;
		height: 6px;
		border-radius: var(--radius-full);
		background: var(--status-safe);
	}

	.unconfirmed-dot {
		width: 6px;
		height: 6px;
		border-radius: var(--radius-full);
		background: var(--status-warn);
	}
</style>
