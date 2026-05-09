<script lang="ts">
	import type { Departure } from '$lib/types';

	interface Props {
		profileName: string;
		stopCode: string;
		stopName: string;
		routeLabel: string;
		routeColor: string;
		headsign: string | null;
		arrivals: Departure[];
		currentTimeSec: number;
	}

	let {
		profileName,
		stopCode,
		stopName,
		routeLabel,
		routeColor,
		headsign,
		arrivals,
		currentTimeSec
	}: Props = $props();

	function timeStrToSec(time: string): number {
		const [h, m, s] = time.split(':').map(Number);
		return h * 3600 + m * 60 + (s || 0);
	}
</script>

<div class="widget">
	<div class="header">
		<span class="route-stripe" style="background: #{routeColor}"></span>
		<span class="route-label">{routeLabel}</span>
		<span class="stop">
			<span class="stop-code" style="color: #{routeColor}">{stopCode}</span>
			<span class="stop-name">{stopName}</span>
		</span>
		{#if headsign}
			<span class="headsign">{headsign}</span>
		{/if}
	</div>

	<div class="profile-chip">{profileName}</div>

	<div class="arrivals">
		{#each arrivals as dep, i (i + ':' + dep.tripId + ':' + dep.departureTime)}
			{@const schedSec = timeStrToSec(dep.departureTime)}
			{@const etaSec = dep.estimatedTime ? timeStrToSec(dep.estimatedTime) : null}
			{@const effSec = etaSec ?? schedSec}
			{@const isPastSched = schedSec <= currentTimeSec}
			{@const isStillComing = isPastSched && etaSec !== null && etaSec > currentTimeSec}
			{@const isPassed = isPastSched && !isStillComing}
			{@const diffSec = effSec - currentTimeSec}
			{@const absMin = Math.max(0, Math.floor(Math.abs(diffSec) / 60))}
			{@const countdown =
				diffSec > 0
					? diffSec < 60
						? 'now'
						: `${absMin} min`
					: `${absMin} min ago`}
			<div class="arrival" class:passed={isPassed}>
				<div class="left">
					<span class="time">{dep.departureTime.substring(0, 5)}</span>
					{#if dep.confirmed === true}
						<span class="dot dot-safe" aria-label="Live GPS"></span>
					{:else if dep.confirmed === false}
						<span class="dot dot-warn" aria-label="Unconfirmed"></span>
					{/if}
					{#if dep.delayMinutes != null}
						{#if dep.delayMinutes > 0}
							<span class="delay delay-late">+{dep.delayMinutes} late</span>
						{:else if dep.delayMinutes < 0}
							<span class="delay delay-early">−{Math.abs(dep.delayMinutes)} early</span>
						{:else}
							<span class="delay delay-ontime">on time</span>
						{/if}
					{/if}
					{#if isStillComing}
						<span class="delay delay-late">delayed</span>
					{/if}
				</div>
				<div class="right">
					<span class="countdown">{countdown}</span>
					{#if isPassed}
						<span class="passed-tag">passed</span>
					{/if}
				</div>
			</div>
		{/each}
	</div>
</div>

<style>
	.widget {
		background: var(--bg-card);
		border: 1px solid var(--border-default);
		border-radius: var(--radius-lg);
		padding: var(--space-lg);
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
	}

	.header {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
		min-width: 0;
	}

	.route-stripe {
		width: 4px;
		height: 18px;
		border-radius: var(--radius-full);
		flex-shrink: 0;
	}

	.route-label {
		font-family: var(--font-mono);
		font-size: var(--text-sm);
		font-weight: var(--weight-semibold);
		flex-shrink: 0;
	}

	.stop {
		display: flex;
		align-items: baseline;
		gap: var(--space-xs);
		min-width: 0;
		flex: 1;
		overflow: hidden;
	}

	.stop-code {
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		font-weight: var(--weight-semibold);
		flex-shrink: 0;
	}

	.stop-name {
		font-size: var(--text-sm);
		color: var(--text-secondary);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		min-width: 0;
	}

	.headsign {
		font-size: var(--text-xs);
		color: var(--text-muted);
		flex-shrink: 0;
		max-width: 35%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.profile-chip {
		display: inline-block;
		font-size: var(--text-xs);
		color: var(--text-muted);
		background: var(--bg-elevated);
		border-radius: var(--radius-full);
		padding: 2px var(--space-sm);
		align-self: flex-start;
		max-width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.arrivals {
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
	}

	.arrival {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-sm);
		padding: var(--space-sm) 0;
		border-top: 1px solid var(--border-subtle);
		transition: opacity var(--transition-fast);
	}

	.arrival:first-child {
		border-top: none;
	}

	.arrival.passed {
		opacity: 0.55;
	}

	.left {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
		min-width: 0;
		flex: 1;
		flex-wrap: wrap;
	}

	.time {
		font-family: var(--font-mono);
		font-size: var(--text-base);
		font-weight: var(--weight-semibold);
	}

	.dot {
		width: 8px;
		height: 8px;
		border-radius: var(--radius-full);
		flex-shrink: 0;
	}

	.dot-safe { background: var(--status-safe); }
	.dot-warn { background: var(--status-warn); }

	.delay {
		font-size: 10px;
		font-weight: var(--weight-medium);
		font-family: var(--font-mono);
		padding: 2px var(--space-sm);
		border-radius: var(--radius-full);
		white-space: nowrap;
	}

	.delay-late {
		color: var(--status-urgent);
		background: var(--status-urgent-bg);
	}

	.delay-early {
		color: var(--status-warn);
		background: var(--status-warn-bg);
	}

	.delay-ontime {
		color: var(--text-muted);
		background: var(--bg-elevated);
	}

	.right {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 2px;
		flex-shrink: 0;
	}

	.countdown {
		font-family: var(--font-mono);
		font-size: var(--text-sm);
		font-weight: var(--weight-semibold);
	}

	.passed-tag {
		font-size: 10px;
		color: var(--status-missed);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}
</style>
