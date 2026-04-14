<script lang="ts">
	import { onMount } from 'svelte';
	import type { ActiveTrip, ActiveTripStep } from '$lib/types';
	import { getActiveTrip, clearActiveTrip } from '$lib/stores/active-trip';
	import { goto } from '$app/navigation';

	let trip = $state<ActiveTrip | null>(null);
	let mounted = false;

	onMount(() => {
		const loaded = getActiveTrip();
		if (!loaded) {
			goto('/');
			return;
		}
		trip = loaded;
		mounted = true;
	});

	// Tick every second
	let now = $state(new Date());
	$effect(() => {
		const interval = setInterval(() => { now = new Date(); }, 1000);
		return () => clearInterval(interval);
	});

	let tz = $derived(trip?.timezone ?? 'Asia/Kuala_Lumpur');

	let nowSec = $derived.by(() => {
		const formatter = new Intl.DateTimeFormat('en-GB', {
			timeZone: tz,
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit',
			hour12: false
		});
		const [h, m, s] = formatter.format(now).split(':').map(Number);
		return h * 3600 + m * 60 + s;
	});

	let nowFormatted = $derived.by(() => {
		const formatter = new Intl.DateTimeFormat('en-US', {
			timeZone: tz,
			hour: 'numeric',
			minute: '2-digit',
			second: '2-digit',
			hour12: true
		});
		return formatter.format(now);
	});

	// Determine which step the "now" marker falls between
	let nowPosition = $derived.by(() => {
		if (!trip) return { beforeIndex: -1, progress: 0 };
		const steps = trip.steps;

		// Before first step
		if (nowSec < steps[0].timeSec) {
			return { beforeIndex: 0, progress: 0 };
		}

		// After last step
		if (nowSec >= steps[steps.length - 1].timeSec) {
			return { beforeIndex: steps.length, progress: 1 };
		}

		// Between steps
		for (let i = 0; i < steps.length - 1; i++) {
			if (nowSec >= steps[i].timeSec && nowSec < steps[i + 1].timeSec) {
				const range = steps[i + 1].timeSec - steps[i].timeSec;
				const progress = range > 0 ? (nowSec - steps[i].timeSec) / range : 0;
				return { beforeIndex: i + 1, progress };
			}
		}

		return { beforeIndex: trip.steps.length, progress: 1 };
	});

	function stepStatus(index: number): 'done' | 'current' | 'upcoming' {
		if (index < nowPosition.beforeIndex) return 'done';
		if (index === nowPosition.beforeIndex) return 'current';
		return 'upcoming';
	}

	function minutesUntilStep(step: ActiveTripStep): number {
		return Math.round((step.timeSec - nowSec) / 60);
	}

	function isArrived(): boolean {
		if (!trip) return false;
		return nowSec >= trip.estimatedArrivalSec;
	}

	function endTrip() {
		clearActiveTrip();
		goto('/');
	}
</script>

{#if trip}
	<div class="trip-page">
		<div class="trip-header">
			<div class="trip-title">{trip.profileName}</div>
			<div class="trip-now">{nowFormatted}</div>
		</div>

		{#if isArrived()}
			<div class="arrived-banner">
				You've arrived!
			</div>
		{/if}

		<div class="live-timeline">
			{#each trip.steps as step, i}
				{@const status = stepStatus(i)}
				{@const isTransit = step.type === 'board' || step.type === 'alight'}
				{@const minsUntil = minutesUntilStep(step)}

				<!-- Now marker: rendered before the step it precedes -->
				{#if i === nowPosition.beforeIndex && !isArrived()}
					<div class="now-marker">
						<div class="now-line"></div>
						<span class="now-label">NOW</span>
						<div class="now-line"></div>
					</div>
				{/if}

				<div class="step" class:done={status === 'done'} class:current={status === 'current'}>
					<!-- Time -->
					<div class="step-time" class:time-bold={isTransit || step.type === 'leave' || step.type === 'arrive'}>
						{step.time}
					</div>

					<!-- Dot + line -->
					<div class="step-vis">
						{#if step.type === 'leave' || step.type === 'arrive'}
							<div class="dot dot-marker" class:dot-done={status === 'done'}></div>
						{:else if step.type === 'walk'}
							<div class="dot dot-walk" class:dot-done={status === 'done'}></div>
						{:else}
							<div class="dot dot-transit" style="background: {status === 'done' ? 'var(--text-muted)' : `#${step.routeColor ?? '6c8cff'}`}"></div>
						{/if}
						{#if i < trip.steps.length - 1}
							{#if step.type === 'board'}
								<div class="line" style="background: {status === 'done' ? 'var(--text-muted)' : `#${step.routeColor ?? '6c8cff'}`}"></div>
							{:else}
								<div class="line line-dashed" class:line-done={status === 'done'}></div>
							{/if}
						{/if}
					</div>

					<!-- Content -->
					<div class="step-content">
						<div class="step-label" class:label-bold={isTransit || step.type === 'leave' || step.type === 'arrive'}>
							{#if step.type === 'board' && step.stopCode}
								Board
								<span class="stop-code" style="color: #{step.routeColor}">{step.stopCode}</span>
								{step.stopName}
							{:else if step.type === 'alight' && step.stopCode}
								Alight
								<span class="stop-code" style="color: #{step.routeColor}">{step.stopCode}</span>
								{step.stopName}
								{#if step.durationMin}
									<span class="dim">~{step.durationMin} min</span>
								{/if}
							{:else if step.type === 'walk'}
								{step.label}
								{#if step.durationMin}
									<span class="dim">{step.durationMin} min</span>
								{/if}
							{:else}
								{step.label}
							{/if}
						</div>

						<!-- Countdown for upcoming steps -->
						{#if status === 'upcoming' && minsUntil > 0}
							<div class="step-countdown">in {minsUntil} min</div>
						{:else if status === 'done'}
							<div class="step-done-check">&#10003;</div>
						{/if}
					</div>
				</div>
			{/each}

			<!-- Now marker after all steps (arrived) -->
			{#if nowPosition.beforeIndex >= trip.steps.length && !isArrived()}
				<div class="now-marker">
					<div class="now-line"></div>
					<span class="now-label">NOW</span>
					<div class="now-line"></div>
				</div>
			{/if}
		</div>

		<button class="end-trip-btn" onclick={endTrip}>
			{isArrived() ? 'Done' : 'End trip'}
		</button>
	</div>
{/if}

<style>
	.trip-page {
		padding-top: var(--space-sm);
	}

	.trip-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: var(--space-xl);
	}

	.trip-title {
		font-size: var(--text-lg);
		font-weight: var(--weight-bold);
	}

	.trip-now {
		font-family: var(--font-mono);
		font-size: var(--text-sm);
		color: var(--text-secondary);
	}

	.arrived-banner {
		text-align: center;
		background: var(--status-safe-bg);
		border: 1px solid var(--status-safe);
		border-radius: var(--radius-md);
		padding: var(--space-md);
		margin-bottom: var(--space-xl);
		font-size: var(--text-lg);
		font-weight: var(--weight-bold);
		color: var(--status-safe);
	}

	.live-timeline {
		background: var(--bg-card);
		border: 1px solid var(--border-default);
		border-radius: var(--radius-xl);
		padding: var(--space-xl) var(--space-lg);
		margin-bottom: var(--space-xl);
	}

	.step {
		display: flex;
		min-height: 44px;
		transition: opacity var(--transition-normal);
	}

	.step.done {
		opacity: 0.6;
	}

	/* Time */
	.step-time {
		width: 72px;
		flex-shrink: 0;
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		color: var(--text-muted);
		padding-top: 1px;
	}

	.time-bold {
		color: var(--text-primary);
		font-weight: var(--weight-semibold);
	}

	/* Visual */
	.step-vis {
		display: flex;
		flex-direction: column;
		align-items: center;
		width: 20px;
		flex-shrink: 0;
	}

	.dot {
		width: 10px;
		height: 10px;
		border-radius: var(--radius-full);
		flex-shrink: 0;
		z-index: 1;
	}

	.dot-marker { background: var(--text-primary); }
	.dot-marker.dot-done { background: var(--text-muted); }
	.dot-walk { background: var(--bg-primary); border: 2px solid var(--text-secondary); }
	.dot-walk.dot-done { border-color: var(--text-muted); }
	.dot-transit { border: none; }

	.line {
		width: 2px;
		flex: 1;
		min-height: 12px;
	}

	.line-dashed {
		background: none;
		border-left: 2px dashed var(--border-default);
		width: 0;
	}

	.line-done {
		border-color: var(--text-muted);
	}

	/* Content */
	.step-content {
		flex: 1;
		padding-left: var(--space-sm);
		padding-bottom: var(--space-md);
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: var(--space-sm);
	}

	.step-label {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
		font-size: var(--text-sm);
		color: var(--text-secondary);
		flex-wrap: wrap;
	}

	.label-bold {
		color: var(--text-primary);
		font-weight: var(--weight-medium);
	}

	.stop-code {
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		font-weight: var(--weight-bold);
	}

	.dim {
		font-size: var(--text-xs);
		color: var(--text-muted);
	}

	.step-countdown {
		font-size: var(--text-xs);
		color: var(--text-muted);
		white-space: nowrap;
		flex-shrink: 0;
	}

	.step-done-check {
		font-size: var(--text-xs);
		color: var(--status-safe);
		flex-shrink: 0;
	}

	/* Now marker */
	.now-marker {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
		padding: var(--space-sm) 0;
		animation: now-pulse 2s ease-in-out infinite;
	}

	.now-line {
		flex: 1;
		height: 2px;
		background: var(--accent);
	}

	.now-label {
		font-size: var(--text-xs);
		font-weight: var(--weight-bold);
		color: var(--accent);
		letter-spacing: 0.1em;
		flex-shrink: 0;
	}

	.end-trip-btn {
		width: 100%;
		padding: var(--space-md);
		background: var(--bg-elevated);
		color: var(--text-primary);
		font-size: var(--text-sm);
		font-weight: var(--weight-semibold);
		border: 1px solid var(--border-default);
		border-radius: var(--radius-md);
		transition: background var(--transition-fast);
	}

	.end-trip-btn:hover { background: var(--bg-card); }
</style>
