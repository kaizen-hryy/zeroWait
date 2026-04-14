<script lang="ts">
	import { onMount } from 'svelte';

	let { data } = $props();

	let currentTheme = $state('dark');

	onMount(() => {
		currentTheme = document.documentElement.getAttribute('data-theme') ?? 'dark';
	});

	function setTheme(theme: string) {
		currentTheme = theme;
		document.documentElement.setAttribute('data-theme', theme);
		localStorage.setItem('theme', theme);
	}

	let importing = $state(false);
	let importResult = $state<string | null>(null);
	let defaultMaxWait = $state(5);
	let maxWaitSaved = $state(false);
	let selectedTimezone = $state(data.currentTimezone);
	let timezoneSaved = $state(false);

	onMount(() => {
		fetch('/api/settings')
			.then((r) => r.json())
			.then((d) => {
				defaultMaxWait = parseInt(d.default_max_wait_minutes ?? '5', 10);
				if (d.timezone) selectedTimezone = d.timezone;
			});
	});

	async function saveMaxWait() {
		await fetch('/api/settings', {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ default_max_wait_minutes: String(defaultMaxWait) })
		});
		maxWaitSaved = true;
		setTimeout(() => { maxWaitSaved = false; }, 2000);
	}

	async function saveTimezone() {
		await fetch('/api/settings', {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ timezone: selectedTimezone })
		});
		timezoneSaved = true;
		setTimeout(() => { timezoneSaved = false; }, 2000);
	}

	async function refreshData() {
		importing = true;
		importResult = null;
		try {
			const res = await fetch('/api/gtfs/import', { method: 'POST' });
			const data = await res.json();
			if (data.success) {
				importResult = 'Import successful! Data refreshed.';
			} else {
				importResult = `Error: ${data.error}`;
			}
		} catch (e) {
			importResult = `Error: ${e}`;
		}
		importing = false;
	}
</script>

<div class="page">
	<h2>Settings</h2>

	<div class="section">
		<h3 class="section-title">Theme</h3>
		<div class="theme-row">
			<button class="theme-option" class:active={currentTheme === 'dark'} onclick={() => setTheme('dark')}>Dark</button>
			<button class="theme-option" class:active={currentTheme === 'light'} onclick={() => setTheme('light')}>Light</button>
		</div>
	</div>

	<div class="section">
		<h3 class="section-title">Default Max Wait at Station</h3>
		<p class="description">
			Maximum time you're willing to wait at any station. The system tells you to leave as late as possible within this window. Individual stops can override this in the profile editor.
		</p>
		<div class="setting-row">
			<div class="input-suffix">
				<input type="number" bind:value={defaultMaxWait} min="1" max="30" />
				<span class="suffix">min</span>
			</div>
			<button class="btn btn-primary btn-sm" onclick={saveMaxWait}>
				{maxWaitSaved ? 'Saved!' : 'Save'}
			</button>
		</div>
	</div>

	<div class="section">
		<h3 class="section-title">Timezone</h3>
		<p class="description">
			All departure times and schedules use this timezone. Defaults to your server's timezone.
		</p>
		<div class="setting-row">
			<select bind:value={selectedTimezone} class="tz-select">
				{#each data.timezones as tz}
					<option value={tz}>{tz}</option>
				{/each}
			</select>
			<button class="btn btn-primary btn-sm" onclick={saveTimezone}>
				{timezoneSaved ? 'Saved!' : 'Save'}
			</button>
		</div>
	</div>

	<div class="section">
		<h3 class="section-title">GTFS Data</h3>
		<p class="description">
			Refresh schedule data from the Malaysian Open API. This fetches the latest timetables for all transit systems.
		</p>
		<button class="btn btn-primary" onclick={refreshData} disabled={importing}>
			{#if importing}<span class="spinner"></span> Importing{:else}Refresh Schedule Data{/if}
		</button>
		{#if importResult}
			<p class="result" class:success={importResult.startsWith('Import')}>{importResult}</p>
		{/if}
	</div>
</div>

<style>
	.page { padding-top: var(--space-sm); }

	.theme-row {
		display: flex;
		gap: var(--space-sm);
	}

	.theme-option {
		flex: 1;
		padding: var(--space-md);
		background: var(--bg-elevated);
		border: 2px solid var(--border-default);
		border-radius: var(--radius-md);
		color: var(--text-secondary);
		font-size: var(--text-sm);
		font-weight: var(--weight-medium);
		transition: all var(--transition-fast);
	}

	.theme-option:hover { border-color: var(--accent); }
	.theme-option.active { border-color: var(--accent); color: var(--accent); background: var(--accent-muted); }

	h2 {
		font-size: var(--text-2xl);
		font-weight: var(--weight-bold);
		margin-bottom: var(--space-xl);
	}

	.section {
		background: var(--bg-card);
		border: 1px solid var(--border-default);
		border-radius: var(--radius-lg);
		padding: var(--space-xl);
		margin-bottom: var(--space-lg);
	}

	.section-title {
		font-size: var(--text-sm);
		font-weight: var(--weight-semibold);
		margin-bottom: var(--space-sm);
	}

	.description {
		font-size: var(--text-sm);
		color: var(--text-secondary);
		margin-bottom: var(--space-lg);
	}

	.setting-row {
		display: flex;
		align-items: center;
		gap: var(--space-md);
	}

	.input-suffix { display: flex; }
	.input-suffix input { width: 70px; border-top-right-radius: 0; border-bottom-right-radius: 0; }
	.suffix {
		background: var(--bg-elevated);
		border: 1px solid var(--border-default);
		border-left: none;
		border-radius: 0 var(--radius-md) var(--radius-md) 0;
		padding: var(--space-md);
		font-size: var(--text-sm);
		color: var(--text-muted);
	}

	.btn {
		display: inline-flex;
		align-items: center;
		font-size: var(--text-sm);
		font-weight: var(--weight-semibold);
		border-radius: var(--radius-md);
		padding: var(--space-md) var(--space-xl);
		cursor: pointer;
		transition: all var(--transition-fast);
	}

	.btn-sm { font-size: var(--text-xs); padding: var(--space-sm) var(--space-lg); }
	.btn-primary { background: var(--accent); color: #fff; }
	.btn-primary:hover { background: var(--accent-hover); }
	.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

	.tz-select { flex: 1; min-width: 0; }

	.result { font-size: var(--text-sm); margin-top: var(--space-md); color: var(--status-urgent); }
	.result.success { color: var(--status-safe); }
</style>
