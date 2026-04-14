<script lang="ts">
	import HeroCard from '$lib/components/HeroCard.svelte';
	import JourneyTimeline from '$lib/components/JourneyTimeline.svelte';
	import Dropdown from '$lib/components/Dropdown.svelte';
	import { onMount } from 'svelte';
	import type { ActiveTrip, ActiveTripStep, Departure } from '$lib/types';
	import type { StepInfo } from './+page.server';
	import { setActiveTrip, getActiveTrip } from '$lib/stores/active-trip';
	import { goto, invalidateAll } from '$app/navigation';

	let { data } = $props();
	let hasActiveTrip = $state(false);
	let showOnboarding = $state(false);

	onMount(() => {
		hasActiveTrip = getActiveTrip() !== null;
		// Show onboarding for new users who haven't dismissed it
		if (!localStorage.getItem('onboarding_completed') && data.rankedRoutes.length === 0 && !data.needsImport) {
			showOnboarding = true;
		}
	});

	function dismissOnboarding() {
		localStorage.setItem('onboarding_completed', 'true');
		showOnboarding = false;
	}

	// Reactive current time (ticks every second)
	let now = $state(new Date());
	$effect(() => {
		const interval = setInterval(() => { now = new Date(); }, 1000);
		return () => clearInterval(interval);
	});

	// Smart auto-refresh: schedules invalidation at the optimal time
	let refreshTimer: ReturnType<typeof setTimeout> | null = null;
	let isVisible = $state(true);

	onMount(() => {
		const onVisibility = () => { isVisible = document.visibilityState === 'visible'; };
		document.addEventListener('visibilitychange', onVisibility);
		return () => document.removeEventListener('visibilitychange', onVisibility);
	});

	$effect(() => {
		// Clear previous timer
		if (refreshTimer) clearTimeout(refreshTimer);

		// Don't schedule if tab is hidden
		if (!isVisible) return;

		const nowSec = getCurrentTimeSeconds();
		let nextRefreshMs = 30_000; // default: 30s for realtime polling

		// Find the soonest departure that will expire (departureTime passes now)
		if (data.mergedDepartures?.length) {
			for (const gd of data.mergedDepartures) {
				const depSec = timeStrToSec(gd.departure.departureTime);
				const msUntilExpiry = (depSec - nowSec) * 1000;
				if (msUntilExpiry > 0 && msUntilExpiry < nextRefreshMs) {
					nextRefreshMs = msUntilExpiry + 1000; // +1s buffer
				}

				// Also check grace expiry
				if (gd.departure.grace && gd.departure.leaveByTime) {
					const leaveSec = timeStrToSec(gd.departure.leaveByTime);
					// Grace expires when departure itself passes (already handled above)
				}
			}
		}

		// Cap at 30s min for realtime, 1s min to avoid tight loops
		nextRefreshMs = Math.max(1000, Math.min(nextRefreshMs, 30_000));

		refreshTimer = setTimeout(async () => {
			if (document.visibilityState === 'visible') {
				await invalidateAll();
			}
		}, nextRefreshMs);

		return () => {
			if (refreshTimer) clearTimeout(refreshTimer);
		};
	});

	// Also refresh immediately when tab becomes visible after being hidden
	let wasHidden = $state(false);
	$effect(() => {
		if (isVisible && wasHidden) {
			invalidateAll();
			wasHidden = false;
		}
		if (!isVisible) {
			wasHidden = true;
		}
	});

	function getCurrentTimeSeconds(): number {
		const tz = data.timezone ?? 'Asia/Kuala_Lumpur';
		const formatter = new Intl.DateTimeFormat('en-GB', {
			timeZone: tz,
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit',
			hour12: false
		});
		const timeStr = formatter.format(now);
		const [h, m, s] = timeStr.split(':').map(Number);
		return h * 3600 + m * 60 + s;
	}

	function minutesUntilTime(time: string | null): number | null {
		if (!time) return null;
		const [h, m, s] = time.split(':').map(Number);
		const targetSeconds = h * 3600 + m * 60 + (s || 0);
		const currentSeconds = getCurrentTimeSeconds();
		return Math.floor((targetSeconds - currentSeconds) / 60);
	}

	let currentTimeSeconds = $derived(getCurrentTimeSeconds());

	// Data freshness display
	let dataAge = $derived.by(() => {
		if (!data.lastRefreshed) return '';
		const ageSec = Math.floor((now.getTime() - data.lastRefreshed) / 1000);
		if (ageSec < 5) return 'just now';
		if (ageSec < 60) return `${ageSec}s ago`;
		return `${Math.floor(ageSec / 60)}m ago`;
	});

	async function triggerImport() {
		importing = true;
		try {
			const res = await fetch('/api/gtfs/import', { method: 'POST' });
			const result = await res.json();
			if (result.success) {
				window.location.reload();
			} else {
				importError = result.error;
			}
		} catch (e) {
			importError = String(e);
		}
		importing = false;
	}

	let importing = $state(false);
	let importError = $state<string | null>(null);
	let selectedMergedIndex = $state(0);
	let showAllDepartures = $state(false);

	// Default to first non-grace departure
	$effect(() => {
		if (data.mergedDepartures?.length) {
			const firstNonGrace = data.mergedDepartures.findIndex((d: any) => !d.departure.grace);
			selectedMergedIndex = firstNonGrace >= 0 ? firstNonGrace : 0;
		}
	});

	// Derive the selected route and departure from the merged selection
	let selectedGroupDep = $derived(data.mergedDepartures?.[selectedMergedIndex] ?? null);
	let selectedRoute = $derived(selectedGroupDep ? data.rankedRoutes[selectedGroupDep.routeIndex] : data.rankedRoutes?.[0] ?? null);
	let selectedDep = $derived(selectedGroupDep?.departure ?? null);

	function buildTripSteps(dep: Departure, stepInfos: StepInfo[]): ActiveTripStep[] {
		const items: ActiveTripStep[] = [];
		let currentSec = timeStrToSec(dep.leaveByTime ?? dep.departureTime);
		const effectiveDepTime = dep.estimatedTime ?? dep.departureTime;
		let isFirstTransit = true;

		items.push({ timeSec: currentSec, time: fmtSec(currentSec), label: 'Leave', type: 'leave' });

		for (const step of stepInfos) {
			if (step.type === 'walk') {
				const min = step.minutes ?? 0;
				currentSec += min * 60;
				items.push({
					timeSec: currentSec,
					time: fmtSec(currentSec),
					label: step.description ?? 'Walk',
					type: 'walk',
					durationMin: min
				});
			} else {
				if (step.maxWaitMinutes) currentSec += step.maxWaitMinutes * 60;
				if (isFirstTransit) {
					const depSec = timeStrToSec(effectiveDepTime);
					if (depSec > currentSec) currentSec = depSec;
					isFirstTransit = false;
				} else if (step.departures?.length) {
					const next = step.departures.find((d) => timeStrToSec(d.departureTime) >= currentSec);
					if (next) {
						const depSec = timeStrToSec(next.estimatedTime ?? next.departureTime);
						if (depSec > currentSec) currentSec = depSec;
					}
				}
				items.push({
					timeSec: currentSec,
					time: fmtSec(currentSec),
					label: `Board at ${step.stopName}`,
					type: 'board',
					stopCode: step.stopCode,
					stopName: step.stopName,
					routeColor: step.routeColor,
					routeLabel: step.routeLabel
				});
				if (step.rideMinutes) {
					currentSec += step.rideMinutes * 60;
					items.push({
						timeSec: currentSec,
						time: fmtSec(currentSec),
						label: `Alight at ${step.toStopName ?? 'destination'}`,
						type: 'alight',
						stopCode: step.toStopCode,
						stopName: step.toStopName,
						routeColor: step.routeColor,
						durationMin: step.rideMinutes
					});
				}
			}
		}

		items.push({ timeSec: currentSec, time: fmtSec(currentSec), label: 'Arrive', type: 'arrive' });
		return items;
	}

	function timeStrToSec(time: string): number {
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

	function selectDeparture(index: number) {
		selectedMergedIndex = index;
	}

	function startTripFor(route: typeof data.rankedRoutes[0], dep: Departure | null) {
		if (!dep || !route) return;

		const tripSteps = buildTripSteps(dep, route.steps);
		const lastStep = tripSteps[tripSteps.length - 1];

		const trip: ActiveTrip = {
			profileId: route.profileId,
			profileName: route.profileName,
			startedAt: Date.now(),
			steps: tripSteps,
			estimatedArrivalSec: lastStep.timeSec,
			timezone: data.timezone
		};

		setActiveTrip(trip);
		goto('/trip');
	}

	async function setActiveView(value: string) {
		await fetch('/api/view', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ activeView: value })
		});
		window.location.href = '/';
	}

	let viewOptions = $derived.by(() => {
		const opts: { value: string; label: string; sublabel?: string }[] = [];
		for (const group of data.groups ?? []) {
			opts.push({
				value: `group:${group.id}`,
				label: group.name,
				sublabel: `${group.profiles.length} route${group.profiles.length !== 1 ? 's' : ''}`
			});
		}
		for (const profile of data.ungroupedProfiles ?? []) {
			opts.push({
				value: `profile:${profile.id}`,
				label: profile.name
			});
		}
		return opts;
	});
</script>

{#if data.needsImport}
	<div class="empty-state">
		<h2>No schedule data</h2>
		<p>Import GTFS data to get started.</p>
		<button class="btn btn-primary" onclick={triggerImport} disabled={importing}>
			{#if importing}<span class="spinner"></span> Importing{:else}Import GTFS Data{/if}
		</button>
		{#if importError}
			<p class="error">{importError}</p>
		{/if}
	</div>
{:else if data.rankedRoutes.length === 0 && data.groups.length === 0}
	{#if showOnboarding}
		<div class="onboarding">
			<h2>Welcome to zeroWait</h2>
			<div class="onboarding-steps">
				<div class="onboarding-step">
					<span class="onboarding-num">1</span>
					<div>
						<strong>Create a profile</strong>
						<p>Define your commute: walk to the station, take a bus or train, walk to your destination.</p>
					</div>
				</div>
				<div class="onboarding-step">
					<span class="onboarding-num">2</span>
					<div>
						<strong>See your countdown</strong>
						<p>The dashboard shows exactly when to leave so you arrive just in time — zero waiting.</p>
					</div>
				</div>
				<div class="onboarding-step">
					<span class="onboarding-num">3</span>
					<div>
						<strong>Track your trip</strong>
						<p>Start a trip and follow along with a live timeline showing where you are in your journey.</p>
					</div>
				</div>
			</div>
			<a href="/profiles/new" class="btn btn-primary">Create Your First Profile</a>
			<button class="btn btn-ghost onboarding-dismiss" onclick={dismissOnboarding}>I'll explore first</button>
		</div>
	{:else}
		<div class="empty-state">
			<h2>No profiles yet</h2>
			<p>Create a commute profile to see your dashboard.</p>
			<a href="/profiles/new" class="btn btn-primary">Create Profile</a>
		</div>
	{/if}
{:else}
	<!-- Active trip banner -->
	{#if hasActiveTrip}
		<a href="/trip" class="trip-banner">
			<span class="trip-banner-dot"></span>
			Trip in progress — tap to view
		</a>
	{/if}

	<!-- Group/profile selector -->
	{#if viewOptions.length > 0}
		<div class="view-selector">
			<Dropdown
				options={viewOptions}
				selected={data.activeView}
				onSelect={setActiveView}
			/>
		</div>
	{/if}

	{#if selectedRoute && selectedDep}
		<div class="dashboard-sections">
			<!-- 1. Hero card — at a glance -->
			<div>
				<HeroCard
					profileName={selectedRoute.profileName}
					routeLabel={selectedRoute.routeLabel}
					routeColor={selectedRoute.routeColor}
					stopCode={selectedRoute.stopCode}
					stopName={selectedRoute.stopName}
					departure={selectedDep}
					minutesUntilLeave={minutesUntilTime(selectedDep.leaveByTime)}
					currentTimeSec={currentTimeSeconds}
				/>
				<button class="start-trip-btn" onclick={() => startTripFor(selectedRoute, selectedDep)}>
					Start this trip
				</button>
				{#if dataAge}
					<div class="data-freshness">Updated {dataAge}</div>
				{/if}
			</div>

			<!-- 2. Departures — max 5, show more -->
			{#if data.mergedDepartures.length > 0}
				<section>
					<h3 class="section-title">Departures</h3>
					<div class="merged-dep-list">
						{#each (showAllDepartures ? data.mergedDepartures : data.mergedDepartures.slice(0, 5)) as gd, i}
							{@const isSelected = i === selectedMergedIndex}
							{@const leaveMin = gd.departure.leaveByTime ? Math.floor((timeStrToSec(gd.departure.leaveByTime) - currentTimeSeconds) / 60) : null}
							<button
								class="merged-dep-item"
								class:selected={isSelected}
								class:grace={gd.departure.grace}
								onclick={() => selectDeparture(i)}
							>
								<div class="mdep-color" style="background: #{gd.routeColor}"></div>
								<div class="mdep-main">
									<div class="mdep-top">
										<span class="mdep-time">{gd.departure.departureTime.substring(0, 5)}</span>
										<span class="mdep-profile">{gd.profileName}</span>
									</div>
									<div class="mdep-bottom">
										<span class="mdep-leave">Leave by {gd.departure.leaveByTime?.substring(0, 5) ?? '--'}</span>
										{#if gd.departure.grace}
											<span class="mdep-grace">might make it</span>
										{/if}
									</div>
								</div>
								<div class="mdep-right">
									{#if leaveMin !== null && leaveMin >= 0}
										<span class="mdep-countdown" class:selected-text={isSelected}>{leaveMin} min</span>
									{:else if gd.departure.grace && leaveMin !== null}
										<span class="mdep-countdown grace-text">{Math.abs(leaveMin)} min ago</span>
									{:else}
										<span class="mdep-countdown">--</span>
									{/if}
								</div>
							</button>
						{/each}
					</div>
					{#if data.mergedDepartures.length > 5}
						<button class="show-more-btn" onclick={() => { showAllDepartures = !showAllDepartures; }}>
							{showAllDepartures ? 'Show less' : `Show ${data.mergedDepartures.length - 5} more`}
						</button>
					{/if}
				</section>
			{/if}

			<!-- 3. Journey details — scrolls into view on selection -->
			<section>
				<h3 class="section-title">Journey Details</h3>
				<div class="journey-card">
					<JourneyTimeline
						steps={selectedRoute.steps}
						selectedDeparture={selectedDep}
					/>
				</div>
			</section>
		</div>
	{:else}
		<div class="empty-state">
			<p>No departures available right now.</p>
		</div>
	{/if}
{/if}

<style>
	.trip-banner {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
		background: var(--status-safe-bg);
		border: 1px solid var(--status-safe);
		border-radius: var(--radius-md);
		padding: var(--space-md) var(--space-lg);
		margin-bottom: var(--space-xl);
		font-size: var(--text-sm);
		font-weight: var(--weight-medium);
		color: var(--status-safe);
		text-decoration: none;
	}

	.trip-banner-dot {
		width: 8px;
		height: 8px;
		border-radius: var(--radius-full);
		background: var(--status-safe);
		animation: pulse 1.5s ease-in-out infinite;
	}

	@keyframes pulse {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.3; }
	}

	.start-trip-btn {
		width: 100%;
		margin-top: var(--space-md);
		padding: var(--space-md);
		background: var(--accent);
		color: #fff;
		font-size: var(--text-sm);
		font-weight: var(--weight-semibold);
		border-radius: var(--radius-md);
		transition: background var(--transition-fast);
	}

	.start-trip-btn:hover { background: var(--accent-hover); }

	.data-freshness {
		text-align: center;
		font-size: 10px;
		color: var(--text-muted);
		margin-top: var(--space-sm);
	}

	.empty-state {
		text-align: center;
		padding: var(--space-3xl) var(--space-lg);
	}

	.empty-state h2 {
		font-size: var(--text-2xl);
		font-weight: var(--weight-bold);
		margin-bottom: var(--space-sm);
	}

	.empty-state p {
		color: var(--text-secondary);
		margin-bottom: var(--space-xl);
	}

	.btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-sm);
		font-size: var(--text-sm);
		font-weight: var(--weight-semibold);
		border: none;
		border-radius: var(--radius-md);
		padding: var(--space-md) var(--space-xl);
		cursor: pointer;
		transition: all var(--transition-fast);
		text-decoration: none;
	}

	.btn-primary {
		background: var(--accent);
		color: #fff;
	}

	.btn-primary:hover { background: var(--accent-hover); }
	.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

	.error {
		color: var(--status-urgent);
		font-size: var(--text-sm);
		margin-top: var(--space-md);
	}

	.view-selector {
		margin-bottom: var(--space-xl);
	}

	.dashboard-sections {
		display: flex;
		flex-direction: column;
		gap: var(--space-xl);
	}

	.journey-card {
		background: var(--bg-card);
		border: 1px solid var(--border-default);
		border-radius: var(--radius-lg);
		padding: var(--space-lg);
	}

	.section-title {
		font-size: var(--text-xs);
		font-weight: var(--weight-semibold);
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: 0.1em;
		margin-bottom: var(--space-md);
	}

	.group-name {
		font-size: var(--text-lg);
		font-weight: var(--weight-bold);
		margin-bottom: var(--space-lg);
	}

	/* Merged departure list */
	.merged-dep-list {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
	}

	.merged-dep-item {
		display: flex;
		align-items: center;
		gap: var(--space-md);
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

	.merged-dep-item:hover { border-color: var(--accent); }
	.merged-dep-item.selected { border-color: var(--status-safe); background: var(--status-safe-bg); }
	.merged-dep-item.grace { border-color: var(--status-grace); background: var(--status-grace-bg); border-style: dashed; }
	.merged-dep-item.grace.selected { border-style: solid; border-width: 2px; }

	.mdep-color {
		width: 4px;
		height: 36px;
		border-radius: var(--radius-full);
		flex-shrink: 0;
	}

	.mdep-main { flex: 1; min-width: 0; }

	.mdep-top {
		display: flex;
		align-items: baseline;
		gap: var(--space-sm);
	}

	.mdep-time {
		font-family: var(--font-mono);
		font-size: var(--text-base);
		font-weight: var(--weight-semibold);
	}

	.mdep-profile {
		font-size: var(--text-xs);
		color: var(--text-muted);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.mdep-bottom {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
	}

	.mdep-leave {
		font-size: var(--text-xs);
		color: var(--text-muted);
	}

	.mdep-grace {
		font-size: 10px;
		color: var(--status-grace);
		font-style: italic;
	}

	.mdep-right {
		text-align: right;
		flex-shrink: 0;
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 2px;
	}

	.mdep-countdown {
		font-family: var(--font-mono);
		font-size: var(--text-sm);
		font-weight: var(--weight-semibold);
	}

	.selected-text { color: var(--status-safe); }
	.grace-text { color: var(--status-grace); }

	.show-more-btn {
		width: 100%;
		margin-top: var(--space-sm);
		padding: var(--space-sm);
		background: none;
		color: var(--accent);
		font-size: var(--text-xs);
		font-weight: var(--weight-medium);
		border-radius: var(--radius-md);
		transition: background var(--transition-fast);
	}

	.show-more-btn:hover { background: var(--accent-muted); }

	/* Onboarding */
	.onboarding {
		text-align: center;
		padding: var(--space-xl) 0;
	}

	.onboarding h2 {
		font-size: var(--text-2xl);
		font-weight: var(--weight-bold);
		margin-bottom: var(--space-xl);
	}

	.onboarding-steps {
		display: flex;
		flex-direction: column;
		gap: var(--space-lg);
		text-align: left;
		margin-bottom: var(--space-2xl);
	}

	.onboarding-step {
		display: flex;
		gap: var(--space-md);
		align-items: flex-start;
		background: var(--bg-card);
		border: 1px solid var(--border-default);
		border-radius: var(--radius-md);
		padding: var(--space-lg);
	}

	.onboarding-step strong {
		display: block;
		margin-bottom: var(--space-xs);
	}

	.onboarding-step p {
		font-size: var(--text-sm);
		color: var(--text-secondary);
		margin: 0;
	}

	.onboarding-num {
		width: 28px;
		height: 28px;
		border-radius: var(--radius-full);
		background: var(--accent);
		color: #fff;
		font-size: var(--text-sm);
		font-weight: var(--weight-bold);
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.onboarding-dismiss {
		display: block;
		margin: var(--space-md) auto 0;
		font-size: var(--text-xs);
	}
</style>
