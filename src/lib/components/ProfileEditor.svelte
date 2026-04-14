<script lang="ts">
	import type { Step, WalkStep, TransitStep, Feed } from '$lib/types';
	import { goto } from '$app/navigation';
	import Dropdown from './Dropdown.svelte';

	interface Props {
		profileId?: string;
		initialName?: string;
		initialGroupId?: string | null;
		initialSteps?: Step[];
		groups?: { id: string; name: string }[];
	}

	let { profileId, initialName = '', initialGroupId = null, initialSteps = [], groups = [] }: Props = $props();

	let name = $state(initialName);
	let groupId = $state<string | null>(initialGroupId);
	let steps = $state<Step[]>(initialSteps.length > 0 ? structuredClone(initialSteps) : [defaultWalk(), defaultTransit()]);
	let saving = $state(false);
	let error = $state<string | null>(null);

	function defaultWalk(): WalkStep {
		return { type: 'walk', description: 'Walk to stop', minutes: 5 };
	}

	function defaultTransit(): TransitStep {
		return {
			type: 'transit',
			feedId: 'rapid-rail-kl',
			routeId: '',
			fromStopId: '',
			toStopId: '',
			directionId: 0,
			maxWaitMinutes: null
		};
	}

	function addWalkStep(arr: Step[]) {
		arr.push(defaultWalk());
		steps = [...steps];
	}

	function addTransitStep(arr: Step[]) {
		arr.push(defaultTransit());
		steps = [...steps];
	}

	function removeStep(arr: Step[], index: number) {
		arr.splice(index, 1);
		steps = [...steps];
	}

	// --- Stop search ---
	interface StopResult { stop_id: string; feed_id: Feed; stop_name: string; }
	let stopSearches = $state<Record<string, { query: string; results: StopResult[]; open: boolean }>>({});

	async function searchStops(key: string, query: string, feedId: Feed) {
		if (query.length < 2) {
			stopSearches[key] = { query, results: [], open: false };
			return;
		}
		try {
			const res = await fetch(`/api/stops?q=${encodeURIComponent(query)}&feed=${feedId}&limit=10`);
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const results = await res.json();
			stopSearches[key] = { query, results, open: true };
		} catch (err) {
			console.error('[ProfileEditor] Failed to search stops:', err);
			stopSearches[key] = { query, results: [], open: false };
		}
	}

	function selectFromStop(key: string, stop: StopResult, transit: TransitStep) {
		transit.fromStopId = stop.stop_id;
		transit.feedId = stop.feed_id as Feed;
		stopSearches[key] = { query: stop.stop_name, results: [], open: false };
		loadRoutes(stop.stop_id, stop.feed_id as Feed, transit, key);
	}

	// --- Route/dest/direction data ---
	let routeOptions = $state<Record<string, { route_id: string; route_short_name: string; route_long_name: string }[]>>({});
	let destStopOptions = $state<Record<string, { stop_id: string; stop_name: string }[]>>({});
	let destSearches = $state<Record<string, string>>({}); // key → selected toStopId
	let directionAutoDetected = $state<Record<string, boolean>>({});
	let directionOptions = $state<Record<string, { directionId: number; headsign: string }[]>>({});

	async function loadRoutes(stopId: string, feedId: Feed, transit: TransitStep, key: string) {
		const rKey = `${stopId}-${feedId}`;
		try {
			const res = await fetch(`/api/stops/${stopId}/routes?feed=${feedId}`);
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			routeOptions[rKey] = await res.json();
			if (routeOptions[rKey].length > 0) {
				transit.routeId = routeOptions[rKey][0].route_id;
				loadDestStops(transit.routeId, feedId, stopId, key);
				loadDirections(transit.routeId, feedId, transit);
			}
		} catch (err) {
			console.error('[ProfileEditor] Failed to load routes:', err);
			routeOptions[rKey] = [];
		}
	}

	async function loadDestStops(routeId: string, feedId: Feed, excludeStopId: string, key: string) {
		const dKey = `${routeId}-${feedId}`;
		try {
			const res = await fetch(`/api/routes/${routeId}/stops?feed=${feedId}&exclude=${excludeStopId}`);
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			destStopOptions[dKey] = await res.json();
		} catch (err) {
			console.error('[ProfileEditor] Failed to load dest stops:', err);
			destStopOptions[dKey] = [];
		}
	}

	async function loadDirections(routeId: string, feedId: Feed, transit: TransitStep) {
		const key = `${routeId}-${feedId}`;
		try {
			const res = await fetch(`/api/routes/${routeId}/directions?feed=${feedId}`);
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			directionOptions[key] = await res.json();
			if (directionOptions[key].length > 0) {
				transit.directionId = directionOptions[key][0].directionId;
			}
		} catch (err) {
			console.error('[ProfileEditor] Failed to load directions:', err);
			directionOptions[key] = [];
		}
	}

	async function selectDestStop(key: string, destStopId: string, transit: TransitStep) {
		transit.toStopId = destStopId;
		destSearches[key] = destStopId;
		try {
			const res = await fetch(
				`/api/routes/${transit.routeId}/direction?feed=${transit.feedId}&from=${transit.fromStopId}&to=${destStopId}`
			);
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const data = await res.json();
			if (data.auto && data.directionId !== null) {
				transit.directionId = data.directionId;
				directionAutoDetected[key] = true;
			} else {
				directionAutoDetected[key] = false;
			}
		} catch (err) {
			console.error('[ProfileEditor] Failed to detect direction:', err);
			directionAutoDetected[key] = false;
		}
	}

	// --- Hydrate existing transit steps ---
	$effect(() => {
		hydrateAll();
	});

	async function hydrateAll() {
		for (let i = 0; i < steps.length; i++) {
			if (steps[i].type === 'transit') await hydrateTransit(`step-${i}`, steps[i] as TransitStep);
		}
	}

	async function hydrateTransit(key: string, transit: TransitStep) {
		if (!transit.fromStopId) return;

		try {
			// Fetch from stop name
			const stopRes = await fetch(`/api/stops/${encodeURIComponent(transit.fromStopId)}?feed=${transit.feedId}`);
			if (stopRes.ok) {
				const stop = await stopRes.json();
				stopSearches[key] = { query: stop.stop_name ?? transit.fromStopId, results: [], open: false };
			}

			// Load routes
			const rKey = `${transit.fromStopId}-${transit.feedId}`;
			const routeRes = await fetch(`/api/stops/${transit.fromStopId}/routes?feed=${transit.feedId}`);
			if (routeRes.ok) routeOptions[rKey] = await routeRes.json();

			// Load dest stops
			if (transit.routeId) {
				const dKey = `${transit.routeId}-${transit.feedId}`;
				const destRes = await fetch(`/api/routes/${transit.routeId}/stops?feed=${transit.feedId}&exclude=${transit.fromStopId}`);
				if (destRes.ok) destStopOptions[dKey] = await destRes.json();
				if (transit.toStopId) destSearches[key] = transit.toStopId;

				// Load directions
				const dirRes = await fetch(`/api/routes/${transit.routeId}/directions?feed=${transit.feedId}`);
				if (dirRes.ok) directionOptions[dKey] = await dirRes.json();
				directionAutoDetected[key] = transit.toStopId ? true : false;
			}
		} catch (err) {
			console.error(`[ProfileEditor] Failed to hydrate transit step ${key}:`, err);
		}
	}

	// --- Save ---
	async function save() {
		if (!name.trim()) { error = 'Profile name is required'; return; }
		const hasTransit = steps.some((s) => s.type === 'transit' && (s as TransitStep).fromStopId);
		if (!hasTransit) { error = 'At least one transit step is required'; return; }

		saving = true;
		error = null;

		const body = { name: name.trim(), groupId, steps };

		try {
			if (profileId) {
				await fetch(`/api/profiles/${profileId}`, {
					method: 'PUT',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(body)
				});
			} else {
				await fetch('/api/profiles', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(body)
				});
			}
			goto('/profiles');
		} catch (e) {
			error = String(e);
		}
		saving = false;
	}

	const FEEDS: { value: Feed; label: string }[] = [
		{ value: 'rapid-rail-kl', label: 'Prasarana Rail' },
		{ value: 'rapid-bus-kl', label: 'RapidKL Bus' },
		{ value: 'rapid-bus-mrtfeeder', label: 'MRT Feeder Bus' },
		{ value: 'ktmb', label: 'KTMB' }
	];
</script>

<div class="editor">
	<div class="field">
		<label class="label">Profile Name</label>
		<input type="text" bind:value={name} placeholder="e.g. Morning Commute" />
	</div>

	{#if groups.length > 0}
		<div class="field">
			<label class="label">Group</label>
			<Dropdown
				options={[
					{ value: '', label: 'No group' },
					...groups.map((g) => ({ value: g.id, label: g.name, sublabel: `${g.profiles?.length ?? 0} route${(g.profiles?.length ?? 0) !== 1 ? 's' : ''}` }))
				]}
				selected={groupId ?? ''}
				onSelect={(v) => { groupId = v || null; }}
			/>
		</div>
	{/if}

	<h3 class="section-title">Journey Steps</h3>

	{#each steps as step, i}
		{#if step.type === 'walk'}
			{@const walk = step as WalkStep}
			<div class="step-card walk">
				<div class="step-header">
					<span class="step-badge walk-badge">Walk</span>
					<button class="btn-remove" onclick={() => removeStep(steps, i)}>Remove</button>
				</div>
				<div class="field">
					<label class="label">Description</label>
					<input type="text" bind:value={walk.description} placeholder="e.g. Walk to Bangsar LRT" />
				</div>
				<div class="field" style="max-width: 160px">
					<label class="label">Duration</label>
					<div class="input-suffix">
						<input type="number" bind:value={walk.minutes} min="0" max="120" />
						<span class="suffix">min</span>
					</div>
				</div>
			</div>
		{:else}
			{@const transit = step as TransitStep}
			{@const key = `step-${i}`}
			<div class="step-card transit">
				<div class="step-header">
					<span class="step-badge transit-badge">Transit</span>
					<button class="btn-remove" onclick={() => removeStep(steps, i)}>Remove</button>
				</div>

				<div class="field">
					<label class="label">Transit System</label>
					<select bind:value={transit.feedId} onchange={() => { transit.fromStopId = ''; transit.routeId = ''; transit.toStopId = ''; }}>
						{#each FEEDS as feed}
							<option value={feed.value}>{feed.label}</option>
						{/each}
					</select>
				</div>

				<div class="field">
					<label class="label">Board at</label>
					<input
						type="text"
						placeholder="Search station..."
						value={stopSearches[key]?.query ?? ''}
						oninput={(e) => searchStops(key, (e.target as HTMLInputElement).value, transit.feedId)}
						onfocus={() => { if (stopSearches[key]?.results?.length) stopSearches[key].open = true; }}
					/>
					{#if stopSearches[key]?.open && stopSearches[key]?.results.length > 0}
						<div class="dropdown">
							{#each stopSearches[key].results as stop}
								<button class="dropdown-item" onclick={() => selectFromStop(key, stop, transit)}>
									{stop.stop_name}
								</button>
							{/each}
						</div>
					{/if}
				</div>

				{#if transit.fromStopId}
					{@const routeKey = `${transit.fromStopId}-${transit.feedId}`}
					{#if routeOptions[routeKey]?.length}
						<div class="field">
							<label class="label">Route</label>
							<select bind:value={transit.routeId} onchange={() => { loadDestStops(transit.routeId, transit.feedId, transit.fromStopId, key); loadDirections(transit.routeId, transit.feedId, transit); }}>
								{#each routeOptions[routeKey] as route}
									<option value={route.route_id}>{route.route_short_name || route.route_long_name || route.route_id}</option>
								{/each}
							</select>
						</div>
					{/if}

					{@const destKey = `${transit.routeId}-${transit.feedId}`}
					{#if destStopOptions[destKey]?.length}
						<div class="field">
							<label class="label">Alight at</label>
							<select
								value={destSearches[key] ?? ''}
								onchange={(e) => selectDestStop(key, (e.target as HTMLSelectElement).value, transit)}
							>
								<option value="" disabled>Select destination stop...</option>
								{#each destStopOptions[destKey] as stop}
									<option value={stop.stop_id}>{stop.stop_name}</option>
								{/each}
							</select>
						</div>
					{/if}

					{@const dirKey = `${transit.routeId}-${transit.feedId}`}
					{#if directionOptions[dirKey]?.length && !directionAutoDetected[key]}
						<div class="field">
							<label class="label">Direction <span class="hint">(could not auto-detect)</span></label>
							<select bind:value={transit.directionId}>
								{#each directionOptions[dirKey] as dir}
									<option value={dir.directionId}>{dir.headsign}</option>
								{/each}
							</select>
						</div>
					{/if}

					<div class="field">
						<label class="label">Max wait at station</label>
						<div class="field-hint">Leave blank to use the global default from Settings. Override here for stops where you want a different wait tolerance.</div>
						<div class="input-suffix" style="max-width: 160px">
							<input
								type="number"
								value={transit.maxWaitMinutes ?? ''}
								placeholder="default"
								min="1"
								max="30"
								oninput={(e) => {
									const val = (e.target as HTMLInputElement).value;
									transit.maxWaitMinutes = val ? parseInt(val, 10) : null;
								}}
							/>
							<span class="suffix">min</span>
						</div>
					</div>
				{/if}
			</div>
		{/if}
	{/each}

	<div class="add-buttons">
		<button class="btn btn-secondary btn-sm" onclick={() => addWalkStep(steps)}>+ Walk</button>
		<button class="btn btn-secondary btn-sm" onclick={() => addTransitStep(steps)}>+ Transit</button>
	</div>

	{#if error}
		<p class="error">{error}</p>
	{/if}

	<div class="actions">
		<button class="btn btn-primary" onclick={save} disabled={saving}>
			{#if saving}<span class="spinner"></span> Saving{:else}{profileId ? 'Update Profile' : 'Create Profile'}{/if}
		</button>
		<a href="/profiles" class="btn btn-ghost">Cancel</a>
	</div>
</div>

<style>
	.editor { padding-top: var(--space-sm); }

	.section-title {
		font-size: var(--text-xs);
		font-weight: var(--weight-semibold);
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: 0.1em;
		margin: var(--space-xl) 0 var(--space-md);
	}

	.muted { font-weight: var(--weight-regular); }
	.hint { font-weight: var(--weight-regular); color: var(--status-warn); text-transform: none; letter-spacing: normal; }

	.field {
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
		margin-bottom: var(--space-md);
		position: relative;
	}

	.label {
		font-size: var(--text-xs);
		font-weight: var(--weight-medium);
		color: var(--text-secondary);
	}

	.field-hint {
		font-size: 10px;
		color: var(--text-muted);
		line-height: 1.3;
		margin-bottom: var(--space-xs);
	}

	.input-suffix { display: flex; }
	.input-suffix input { border-top-right-radius: 0; border-bottom-right-radius: 0; width: 100%; }
	.suffix {
		background: var(--bg-elevated);
		border: 1px solid var(--border-default);
		border-left: none;
		border-radius: 0 var(--radius-md) var(--radius-md) 0;
		padding: var(--space-md);
		font-size: var(--text-sm);
		color: var(--text-muted);
		white-space: nowrap;
	}

	.step-card {
		background: var(--bg-card);
		border: 1px solid var(--border-default);
		border-radius: var(--radius-lg);
		padding: var(--space-lg);
		margin-bottom: var(--space-md);
	}

	.step-card.walk { border-left: 3px solid var(--text-muted); }
	.step-card.transit { border-left: 3px solid var(--accent); }
	.step-card.nested { background: var(--bg-secondary); }

	.step-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: var(--space-md);
	}

	.step-badge {
		font-size: var(--text-xs);
		font-weight: var(--weight-semibold);
		padding: 2px var(--space-sm);
		border-radius: var(--radius-sm);
		background: var(--bg-elevated);
		color: var(--text-secondary);
	}

	.walk-badge { background: var(--bg-elevated); color: var(--text-muted); }
	.transit-badge { background: var(--accent-muted); color: var(--accent); }

	.btn-remove { font-size: var(--text-xs); color: var(--status-urgent); cursor: pointer; }
	.btn-remove:hover { text-decoration: underline; }

	.add-buttons {
		display: flex;
		gap: var(--space-sm);
		margin-bottom: var(--space-md);
	}

	.dropdown {
		position: absolute;
		top: 100%;
		left: 0;
		right: 0;
		background: var(--bg-card);
		border: 1px solid var(--border-default);
		border-radius: var(--radius-md);
		max-height: 200px;
		overflow-y: auto;
		z-index: 20;
		box-shadow: var(--shadow-elevated);
	}

	.dropdown-item {
		display: block;
		width: 100%;
		text-align: left;
		padding: var(--space-sm) var(--space-md);
		font-size: var(--text-sm);
		color: var(--text-primary);
		cursor: pointer;
	}
	.dropdown-item:hover { background: var(--accent-muted); }

	.btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		font-size: var(--text-sm);
		font-weight: var(--weight-semibold);
		border-radius: var(--radius-md);
		padding: var(--space-md) var(--space-xl);
		cursor: pointer;
		transition: all var(--transition-fast);
		text-decoration: none;
	}
	.btn-sm { font-size: var(--text-xs); padding: var(--space-sm) var(--space-lg); }
	.btn-primary { background: var(--accent); color: #fff; }
	.btn-primary:hover { background: var(--accent-hover); }
	.btn-primary:disabled { opacity: 0.5; }
	.btn-secondary { background: var(--bg-elevated); color: var(--text-primary); border: 1px solid var(--border-default); }
	.btn-secondary:hover { background: var(--bg-card); }
	.btn-ghost { color: var(--text-secondary); }
	.btn-ghost:hover { color: var(--text-primary); }

	.error { color: var(--status-urgent); font-size: var(--text-sm); margin: var(--space-md) 0; }
	.actions { display: flex; gap: var(--space-md); margin-top: var(--space-xl); }
</style>
