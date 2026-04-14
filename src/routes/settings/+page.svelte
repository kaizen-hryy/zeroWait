<script lang="ts">
	import { onMount } from 'svelte';
	import Dropdown from '$lib/components/Dropdown.svelte';

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

	// --- Backup ---
	let dailyBackupEnabled = $state(data.dailyBackupEnabled);
	let backups = $state(data.backups);
	let backupMsg = $state<string | null>(null);
	let backupMsgType = $state<'success' | 'error'>('success');
	let restoring = $state(false);

	async function toggleDailyBackup() {
		dailyBackupEnabled = !dailyBackupEnabled;
		await fetch('/api/settings', {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ daily_backup_enabled: String(dailyBackupEnabled) })
		});
	}

	async function downloadBackup() {
		const res = await fetch('/api/backup');
		const backup = await res.json();
		const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `zerowait-backup-${new Date().toISOString().split('T')[0]}.json`;
		a.click();
		URL.revokeObjectURL(url);
	}

	async function uploadRestore(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

		restoring = true;
		backupMsg = null;
		try {
			const text = await file.text();
			const data = JSON.parse(text);
			const res = await fetch('/api/backup', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(data)
			});
			const result = await res.json();
			if (result.success) {
				backupMsg = `Restored ${result.profiles} profiles and ${result.groups} groups.`;
				backupMsgType = 'success';
			} else {
				backupMsg = `Error: ${result.error}`;
				backupMsgType = 'error';
			}
		} catch (err) {
			backupMsg = `Error: ${err}`;
			backupMsgType = 'error';
		}
		restoring = false;
		input.value = '';
	}

	async function backupNow() {
		backupMsg = null;
		try {
			const res = await fetch('/api/backup/list', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'backup-now' })
			});
			const result = await res.json();
			if (result.success) {
				backupMsg = `Backup saved: ${result.filename}`;
				backupMsgType = 'success';
				await refreshBackupList();
			}
		} catch (err) {
			backupMsg = `Error: ${err}`;
			backupMsgType = 'error';
		}
	}

	async function restoreFromServer(filename: string) {
		restoring = true;
		backupMsg = null;
		try {
			const res = await fetch('/api/backup/list', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'restore', filename })
			});
			const result = await res.json();
			if (result.success) {
				backupMsg = `Restored ${result.profiles} profiles and ${result.groups} groups from ${filename}.`;
				backupMsgType = 'success';
			} else {
				backupMsg = `Error: ${result.error}`;
				backupMsgType = 'error';
			}
		} catch (err) {
			backupMsg = `Error: ${err}`;
			backupMsgType = 'error';
		}
		restoring = false;
	}

	async function refreshBackupList() {
		const res = await fetch('/api/backup/list');
		backups = await res.json();
	}

	function formatBytes(bytes: number): string {
		if (bytes < 1024) return `${bytes} B`;
		return `${(bytes / 1024).toFixed(1)} KB`;
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
		<div class="setting-row tz-row">
			<div class="tz-dropdown">
				<Dropdown
					options={data.timezones.map((tz) => ({ value: tz, label: tz }))}
					selected={selectedTimezone}
					onSelect={(v) => { selectedTimezone = v; }}
					searchable
				/>
			</div>
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

	<div class="section">
		<h3 class="section-title">Backup & Restore</h3>
		<p class="description">
			Download a backup of your profiles, groups, and settings. Restore from a backup file to recover your data.
		</p>

		<div class="backup-actions">
			<button class="btn btn-primary btn-sm" onclick={downloadBackup}>Download Backup</button>
			<label class="btn btn-secondary btn-sm upload-label">
				{restoring ? 'Restoring...' : 'Restore from File'}
				<input type="file" accept=".json" onchange={uploadRestore} hidden disabled={restoring} />
			</label>
		</div>

		{#if backupMsg}
			<p class="result" class:success={backupMsgType === 'success'}>{backupMsg}</p>
		{/if}

		<div class="backup-toggle">
			<label class="toggle-row">
				<input type="checkbox" checked={dailyBackupEnabled} onchange={toggleDailyBackup} />
				<span class="toggle-label">Daily automatic backup</span>
			</label>
			<p class="toggle-hint">Saves a backup every day at 4:00 AM. Keeps the last 7 days.</p>
		</div>

		{#if dailyBackupEnabled}
			<div class="backup-list-header">
				<span class="backup-list-title">Saved Backups</span>
				<button class="btn-link" onclick={backupNow}>Backup now</button>
			</div>
			{#if backups.length > 0}
				<div class="backup-list">
					{#each backups as b (b.filename)}
						<div class="backup-item">
							<div class="backup-info">
								<span class="backup-name">{b.filename}</span>
								<span class="backup-meta">{formatBytes(b.size)}</span>
							</div>
							<button class="btn-link" onclick={() => restoreFromServer(b.filename)} disabled={restoring}>Restore</button>
						</div>
					{/each}
				</div>
			{:else}
				<p class="no-backups">No backups yet. The first one will run at 4:00 AM.</p>
			{/if}
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

	.tz-dropdown { flex: 1; min-width: 0; }
	.tz-row { align-items: flex-start; }

	.result { font-size: var(--text-sm); margin-top: var(--space-md); color: var(--status-urgent); }
	.result.success { color: var(--status-safe); }

	.backup-actions {
		display: flex;
		gap: var(--space-sm);
		margin-bottom: var(--space-lg);
	}

	.btn-secondary {
		background: var(--bg-elevated);
		color: var(--text-primary);
		border: 1px solid var(--border-default);
	}

	.btn-secondary:hover { background: var(--bg-card); }

	.upload-label { cursor: pointer; }

	.backup-toggle {
		margin-bottom: var(--space-lg);
	}

	.toggle-row {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
		cursor: pointer;
	}

	.toggle-row input[type="checkbox"] {
		width: 18px;
		height: 18px;
		accent-color: var(--accent);
	}

	.toggle-label {
		font-size: var(--text-sm);
		font-weight: var(--weight-medium);
	}

	.toggle-hint {
		font-size: var(--text-xs);
		color: var(--text-muted);
		margin-top: var(--space-xs);
		margin-left: 26px;
	}

	.backup-list-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: var(--space-sm);
	}

	.backup-list-title {
		font-size: var(--text-xs);
		font-weight: var(--weight-semibold);
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: 0.1em;
	}

	.btn-link {
		background: none;
		border: none;
		color: var(--accent);
		font-size: var(--text-xs);
		font-weight: var(--weight-medium);
		cursor: pointer;
		padding: 0;
	}

	.btn-link:hover { text-decoration: underline; }
	.btn-link:disabled { opacity: 0.5; cursor: not-allowed; }

	.backup-list {
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
	}

	.backup-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: var(--space-sm) var(--space-md);
		background: var(--bg-elevated);
		border-radius: var(--radius-sm);
		font-size: var(--text-sm);
	}

	.backup-info {
		display: flex;
		align-items: baseline;
		gap: var(--space-sm);
		min-width: 0;
	}

	.backup-name {
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.backup-meta {
		font-size: 10px;
		color: var(--text-muted);
		white-space: nowrap;
	}

	.no-backups {
		font-size: var(--text-sm);
		color: var(--text-muted);
		font-style: italic;
	}
</style>
