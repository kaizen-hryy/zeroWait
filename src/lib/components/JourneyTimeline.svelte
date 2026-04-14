<script lang="ts">
	import type { StepInfo } from '../../routes/+page.server';
	import type { Departure } from '$lib/types';

	interface Props {
		steps: StepInfo[];
		selectedDeparture: Departure | null;
	}

	let { steps, selectedDeparture }: Props = $props();

	// Compute timeline entries
	let entries = $derived.by(() => {
		if (!selectedDeparture?.leaveByTime) return [];

		const items: {
			time: string;
			step: StepInfo | null;
			type: 'leave' | 'walk' | 'board' | 'alight' | 'arrive';
			stepIndex: number;
		}[] = [];

		// Use ETA-adjusted leave-by time (already adjusted in departures service)
		let currentSec = timeToSec(selectedDeparture.leaveByTime);
		items.push({ time: fmtSec(currentSec), step: null, type: 'leave', stepIndex: -1 });

		// Use estimated time if available, otherwise scheduled
		const effectiveDepartureTime = selectedDeparture.estimatedTime ?? selectedDeparture.departureTime;
		let isFirstTransit = true;

		for (let si = 0; si < steps.length; si++) {
			const step = steps[si];
			if (step.type === 'walk') {
				currentSec += (step.minutes ?? 0) * 60;
				items.push({ time: fmtSec(currentSec), step, type: 'walk', stepIndex: si });
			} else {
				if (step.maxWaitMinutes) currentSec += step.maxWaitMinutes * 60;

				// First transit uses the selected departure's (possibly ETA-adjusted) time
				// Subsequent transits use their own scheduled departures from step info
				if (isFirstTransit) {
					const depSec = timeToSec(effectiveDepartureTime);
					if (depSec > currentSec) currentSec = depSec;
					isFirstTransit = false;
				} else if (step.departures && step.departures.length > 0) {
					// For subsequent transit steps, find earliest departure after current time
					const nextDep = step.departures.find((d) => timeToSec(d.departureTime) >= currentSec);
					if (nextDep) {
						const depSec = timeToSec(nextDep.estimatedTime ?? nextDep.departureTime);
						if (depSec > currentSec) currentSec = depSec;
					}
				}

				items.push({ time: fmtSec(currentSec), step, type: 'board', stepIndex: si });

				if (step.rideMinutes) {
					currentSec += step.rideMinutes * 60;
					items.push({ time: fmtSec(currentSec), step, type: 'alight', stepIndex: si });
				}
			}
		}

		items.push({ time: fmtSec(currentSec), step: null, type: 'arrive', stepIndex: -1 });
		return items;
	});

	function timeToSec(time: string): number {
		const [h, m, s] = time.split(':').map(Number);
		return h * 3600 + m * 60 + (s || 0);
	}

	function fmtSec(sec: number): string {
		const h = Math.floor(sec / 3600) % 24;
		const m = Math.floor((sec % 3600) / 60);
		const ampm = h >= 12 ? 'PM' : 'AM';
		const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
		return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
	}
</script>

{#if entries.length > 0}
	<div class="timeline">
		{#each entries as entry, i}
			{@const isLast = i === entries.length - 1}
			{@const isTransit = entry.type === 'board' || entry.type === 'alight'}
			{@const color = entry.step?.routeColor}
			<!-- Step header: time + dot + content, vertically centered -->
			<div class="step-header">
				<span class="time" class:time-bold={isTransit || entry.type === 'leave' || entry.type === 'arrive'}>{entry.time}</span>
				<div class="dot-wrap">
					{#if entry.type === 'leave' || entry.type === 'arrive'}
						<div class="dot dot-marker"></div>
					{:else if entry.type === 'walk'}
						<div class="dot dot-walk"></div>
					{:else}
						<div class="dot dot-transit" style="background: #{color}"></div>
					{/if}
				</div>
				<div class="content">
					{#if entry.type === 'leave'}
						<span class="marker-text">Leave</span>
					{:else if entry.type === 'arrive'}
						<span class="marker-text">Arrive</span>
					{:else if entry.type === 'walk'}
						<span class="walk-text">{entry.step?.description ?? 'Walk'}</span>
					{:else if entry.type === 'board' && entry.step}
						<div class="stop-line">
							<span class="stop-code" style="color: #{color}">{entry.step.stopCode}</span>
							<span class="stop-name">{entry.step.stopName}</span>
						</div>
					{:else if entry.type === 'alight' && entry.step}
						<div class="stop-line">
							<span class="stop-code" style="color: #{color}">{entry.step.toStopCode}</span>
							<span class="stop-name">{entry.step.toStopName}</span>
						</div>
					{/if}
				</div>
			</div>
			<!-- Connector line to next step -->
			{#if !isLast}
				<div class="connector">
					<div class="connector-spacer"></div>
					<div class="connector-line-wrap">
						{#if entry.type === 'board'}
							<div class="line" style="background: #{color}"></div>
						{:else}
							<div class="line line-dashed"></div>
						{/if}
					</div>
				</div>
			{/if}
		{/each}
	</div>
{/if}

<style>
	.timeline {
		display: flex;
		flex-direction: column;
	}

	/* Header: time + dot + content on one horizontal line, centered */
	.step-header {
		display: flex;
		align-items: center;
		gap: 0;
	}

	.time {
		width: 72px;
		flex-shrink: 0;
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		color: var(--text-muted);
	}

	.time-bold {
		color: var(--text-primary);
		font-weight: var(--weight-semibold);
	}

	.dot-wrap {
		width: 20px;
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.dot {
		width: 10px;
		height: 10px;
		border-radius: var(--radius-full);
		flex-shrink: 0;
	}

	.dot-marker { background: var(--text-muted); }
	.dot-walk { background: var(--bg-primary); border: 2px solid var(--text-muted); }
	.dot-transit { border: none; }

	.content {
		flex: 1;
		min-width: 0;
		padding-left: var(--space-sm);
	}

	/* Connector line between steps */
	.connector {
		display: flex;
	}

	.connector-spacer {
		width: 72px;
		flex-shrink: 0;
	}

	.connector-line-wrap {
		width: 20px;
		flex-shrink: 0;
		display: flex;
		justify-content: center;
	}

	.line {
		width: 2px;
		height: var(--space-lg);
	}

	.line-dashed {
		background: none;
		border-left: 2px dashed var(--border-default);
		width: 0;
		height: var(--space-lg);
	}

	.marker-text {
		font-size: var(--text-sm);
		font-weight: var(--weight-semibold);
		color: var(--text-primary);
	}

	.walk-text {
		font-size: var(--text-sm);
		color: var(--text-muted);
	}

	.stop-line {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
		min-width: 0;
	}

	.stop-code {
		font-family: var(--font-mono);
		font-size: var(--text-sm);
		font-weight: var(--weight-bold);
		flex-shrink: 0;
	}

	.stop-name {
		font-size: var(--text-sm);
		color: var(--text-secondary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}


</style>
