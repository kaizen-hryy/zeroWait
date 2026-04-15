<script lang="ts">
	import type { Departure } from '$lib/types';
	import LinePill from './LinePill.svelte';
	import StatusBadge from './StatusBadge.svelte';

	interface Props {
		profileName: string;
		routeLabel: string;
		routeColor: string;
		stopCode: string;
		stopName: string;
		departure: Departure | null;
		minutesUntilLeave: number | null;
		currentTimeSec: number;
	}

	let { profileName, routeLabel, routeColor, stopCode, stopName, departure, minutesUntilLeave, currentTimeSec }: Props = $props();

	let hasEta = $derived(departure?.estimatedTime !== null && departure?.estimatedTime !== undefined);

	// Animation: countdown pop on value change (only within same departure)
	let prevCountdown = $state<string | number>('');
	let prevTripForPop = $state('');
	let popActive = $state(false);
	$effect(() => {
		const current = countdownDisplay;
		const tripId = departure?.tripId ?? '';
		// Only pop when the number changes within the same departure
		if (current !== prevCountdown && prevCountdown !== '' && tripId === prevTripForPop) {
			popActive = true;
			setTimeout(() => { popActive = false; }, 150);
		}
		prevCountdown = current;
		prevTripForPop = tripId;
	});

	// Animation: vehicle approaching glow
	let vehicleApproaching = $derived(
		departure?.confirmed === true && minutesUntilDepart !== null && minutesUntilDepart <= 3 && minutesUntilDepart > 0
	);

	// Minutes until the vehicle actually departs
	// Use the LATER of scheduled vs ETA — a bus that's "early" per GPS
	// doesn't depart early, it waits at the stop
	let minutesUntilDepart = $derived.by(() => {
		if (!departure) return null;
		const scheduledSec = timeToSec(departure.departureTime);
		const etaSec = departure.estimatedTime ? timeToSec(departure.estimatedTime) : scheduledSec;
		const effectiveSec = Math.max(scheduledSec, etaSec);
		return Math.floor((effectiveSec - currentTimeSec) / 60);
	});

	// Status based on two factors:
	// 1. Can I still leave in time? (minutesUntilLeave)
	// 2. Has the vehicle departed? (minutesUntilDepart)
	let status = $derived.by((): 'safe' | 'warn' | 'urgent' | 'grace' | 'missed' => {
		if (!departure || minutesUntilLeave === null || minutesUntilDepart === null) return 'missed';

		// Vehicle has already departed — missed, period
		if (minutesUntilDepart <= 0) return 'missed';

		// Vehicle hasn't departed yet — can I make it?
		if (minutesUntilLeave >= 10) return 'safe';
		if (minutesUntilLeave >= 3) return 'warn';
		if (minutesUntilLeave >= 0) return 'urgent';

		// Leave-by has passed, but vehicle still hasn't departed — hurry!
		return 'grace';
	});

	let statusLabel = $derived.by(() => {
		if (!departure || minutesUntilDepart === null) return 'No departures';

		if (status === 'missed') return 'Missed';
		if (status === 'grace') return `Hurry! Departs in ${minutesUntilDepart} min`;
		if (status === 'urgent') return 'Leave now!';
		if (status === 'warn') return 'Leave soon';
		return 'Plenty of time';
	});

	// Countdown shows time until leave-by (positive) or time until departure for grace
	let countdownDisplay = $derived.by(() => {
		if (minutesUntilLeave === null) return '--';
		if (status === 'grace' && minutesUntilDepart !== null) return minutesUntilDepart;
		if (status === 'missed') return '--';
		return String(Math.max(0, minutesUntilLeave));
	});

	let countdownUnit = $derived('min');

	let statusColorVar = $derived.by(() => {
		if (status === 'safe') return 'var(--status-safe)';
		if (status === 'warn') return 'var(--status-warn)';
		if (status === 'grace') return 'var(--status-grace)';
		if (status === 'urgent') return 'var(--status-urgent)';
		return 'var(--status-missed)';
	});

	function fmt(time: string | null | undefined): string {
		if (!time) return '--:--';
		return time.substring(0, 5);
	}

	function timeToSec(time: string): number {
		const [h, m, s] = time.split(':').map(Number);
		return h * 3600 + m * 60 + (s || 0);
	}
</script>

<div class="hero-card">
	<div class="line-accent" style="background: #{routeColor}"></div>

	<div class="card-content">
		<!-- Profile name + route pill -->
		<div class="row-between">
			<span class="profile-name">{profileName}</span>
			<LinePill label={routeLabel} color={routeColor} />
		</div>

		{#if departure}
			<!-- Countdown + status -->
			<div class="countdown-block">
				<span
					class="number"
					class:pop={popActive}
					class:urgency-pulse={status === 'urgent' || status === 'grace'}
					style="color: {statusColorVar}"
				>{countdownDisplay}</span>
				{#if countdownUnit}
					<span class="unit">{countdownUnit}</span>
				{/if}
				<StatusBadge {status} label={statusLabel} />
			</div>

			<!-- Time grid -->
			<div class="time-grid">
				<div class="time-cell">
					<span class="time-label">Leave by</span>
					<span class="time-value">{fmt(departure.leaveByTime)}</span>
				</div>
				<div class="time-cell">
					<span class="time-label">Scheduled</span>
					<span class="time-value">{fmt(departure.departureTime)}</span>
				</div>
				{#if hasEta}
					<div class="time-cell">
						<span class="time-label">ETA</span>
						<span class="time-value eta-value" class:approaching-glow={vehicleApproaching}>{fmt(departure.estimatedTime)}</span>
					</div>
				{/if}
				{#if departure.stationWaitMinutes !== null && departure.stationWaitMinutes !== undefined}
					<div class="time-cell">
						<span class="time-label">Wait</span>
						<span class="time-value wait-value">{departure.stationWaitMinutes}m</span>
					</div>
				{/if}
			</div>

			<!-- Stop info + realtime -->
			<div class="footer">
				<div class="stop-row">
					<span class="stop-code" style="color: #{routeColor}">{stopCode}</span>
					<span class="stop-name">{stopName}</span>
				</div>
				<div class="realtime-row">
					{#if departure.confirmed === true}
						<span class="rt-confirmed">
							{#if departure.vehicleId}{departure.vehicleId}{:else}Live{/if}
						</span>
					{:else if departure.confirmed === false}
						<span class="rt-unconfirmed">Unconfirmed</span>
					{:else if departure.confirmed === null}
						<span class="rt-scheduled">Scheduled</span>
					{/if}
					{#if (departure.confirmed === true || departure.confirmed === false) && hasEta && departure.delayMinutes}
						{#if departure.delayMinutes > 1}
							<span class="rt-delay late">~{departure.delayMinutes} min late</span>
						{:else if departure.delayMinutes < -1}
							<span class="rt-delay early">~{Math.abs(departure.delayMinutes)} min early</span>
						{:else}
							<span class="rt-delay ontime">On time</span>
						{/if}
					{/if}
				</div>
			</div>
		{:else}
			<div class="empty">No more services today</div>
		{/if}
	</div>
</div>

<style>
	.hero-card {
		background: var(--bg-card);
		border: 1px solid var(--border-default);
		border-radius: var(--radius-xl);
		padding: var(--space-xl);
		box-shadow: var(--shadow-card);
		position: relative;
		overflow: hidden;
	}

	.line-accent {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		height: 3px;
	}

	.card-content {
		display: flex;
		flex-direction: column;
		gap: var(--space-lg);
	}

	.row-between {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.profile-name {
		font-size: var(--text-sm);
		font-weight: var(--weight-semibold);
	}

	.countdown-block {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-xs);
	}

	.number {
		font-size: var(--text-countdown);
		font-weight: var(--weight-bold);
		letter-spacing: -0.03em;
		line-height: 1;
		transition: color 0.3s ease;
	}

	.unit {
		font-size: var(--text-sm);
		font-weight: var(--weight-medium);
		color: var(--text-secondary);
		text-align: center;
		margin-bottom: var(--space-xs);
	}

	.time-grid {
		display: flex;
		gap: var(--space-sm);
	}

	.time-cell {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2px;
		background: var(--bg-elevated);
		border-radius: var(--radius-md);
		padding: var(--space-sm) var(--space-md);
	}

	.time-label {
		font-size: 10px;
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		text-align: center;
	}

	.time-value {
		font-family: var(--font-mono);
		font-size: var(--text-lg);
		font-weight: var(--weight-semibold);
		text-align: center;
	}

	.number.pop { animation: countdown-pop 150ms ease-out; }
	.number.urgency-pulse { animation: urgency-pulse 1.5s ease-in-out infinite; }

	.eta-value { color: var(--accent); }
	.eta-value.approaching-glow { animation: glow-pulse 2s ease-in-out infinite; }
	.wait-value { color: var(--text-muted); font-size: var(--text-base); }

	.footer {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-sm);
	}

	.stop-row {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-sm);
	}

	.stop-code {
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		font-weight: var(--weight-bold);
	}

	.stop-name {
		font-size: var(--text-sm);
		color: var(--text-secondary);
	}

	.realtime-row {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-sm);
		font-size: var(--text-xs);
	}

	.rt-confirmed {
		font-family: var(--font-mono);
		color: var(--status-safe);
		background: var(--status-safe-bg);
		padding: 1px var(--space-sm);
		border-radius: var(--radius-sm);
	}

	.rt-unconfirmed {
		color: var(--status-warn);
		background: var(--status-warn-bg);
		padding: 1px var(--space-sm);
		border-radius: var(--radius-sm);
	}

	.rt-scheduled {
		color: var(--text-muted);
		background: var(--bg-elevated);
		padding: 1px var(--space-sm);
		border-radius: var(--radius-sm);
	}

	.rt-delay {
		font-weight: var(--weight-semibold);
		padding: 1px var(--space-sm);
		border-radius: var(--radius-sm);
	}

	.rt-delay.late { color: var(--status-urgent); background: var(--status-urgent-bg); }
	.rt-delay.early { color: var(--status-safe); background: var(--status-safe-bg); }
	.rt-delay.ontime { color: var(--status-safe); background: var(--status-safe-bg); }

	.empty {
		text-align: center;
		color: var(--text-muted);
		padding: var(--space-xl) 0;
	}
</style>
