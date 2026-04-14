<script lang="ts">
	let { data } = $props();

	let newGroupName = $state('');
	let ungrouped = $derived(data.profiles.filter((p: any) => !p.groupId));

	// Track which group has "add profile" picker open
	let addingToGroup = $state<string | null>(null);

	async function deleteProfile(id: string) {
		if (!confirm('Delete this profile?')) return;
		await fetch(`/api/profiles/${id}`, { method: 'DELETE' });
		window.location.reload();
	}

	async function createGroup() {
		if (!newGroupName.trim()) return;
		await fetch('/api/groups', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ name: newGroupName.trim() })
		});
		newGroupName = '';
		window.location.reload();
	}

	async function deleteGroup(id: string) {
		if (!confirm('Delete this group? Profiles will be ungrouped.')) return;
		await fetch(`/api/groups/${id}`, { method: 'DELETE' });
		window.location.reload();
	}

	async function moveToGroup(profileId: string, groupId: string | null) {
		await fetch(`/api/profiles/${profileId}`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ groupId })
		});
		addingToGroup = null;
		window.location.reload();
	}

	async function removeFromGroup(profileId: string) {
		await moveToGroup(profileId, null);
	}
</script>

<div class="page">
	<div class="header">
		<h2>Profiles</h2>
		<a href="/profiles/new" class="btn btn-primary btn-sm">+ New</a>
	</div>

	<!-- Groups -->
	{#each data.groups as group}
		<div class="group-card">
			<div class="group-top">
				<div class="group-info">
					<span class="group-name">{group.name}</span>
					<span class="group-count">{group.profiles.length} route{group.profiles.length !== 1 ? 's' : ''}</span>
				</div>
				<button class="icon-btn danger" onclick={() => deleteGroup(group.id)} title="Delete group">&#10005;</button>
			</div>

			<div class="group-profiles">
				{#each group.profiles as profile, i}
					<div class="profile-row">
						<div class="profile-info">
							<span class="profile-name">{profile.name}</span>
							<span class="profile-meta">{profile.steps.length} step{profile.steps.length !== 1 ? 's' : ''}</span>
						</div>
						<div class="profile-actions">
							<a href="/profiles/{profile.id}/edit" class="icon-btn" title="Edit">&#9998;</a>
							<button class="icon-btn" onclick={() => removeFromGroup(profile.id)} title="Remove from group">&#8614;</button>
							<button class="icon-btn danger" onclick={() => deleteProfile(profile.id)} title="Delete">&#10005;</button>
						</div>
					</div>
				{/each}
			</div>

			<!-- Add existing profile to group -->
			{#if ungrouped.length > 0}
				{#if addingToGroup === group.id}
					<div class="add-picker">
						<span class="add-picker-label">Add a profile:</span>
						{#each ungrouped as profile}
							<button class="add-picker-item" onclick={() => moveToGroup(profile.id, group.id)}>
								{profile.name}
							</button>
						{/each}
						<button class="add-picker-cancel" onclick={() => { addingToGroup = null; }}>Cancel</button>
					</div>
				{:else}
					<button class="add-profile-btn" onclick={() => { addingToGroup = group.id; }}>
						+ Add existing profile
					</button>
				{/if}
			{/if}
		</div>
	{/each}

	<!-- Ungrouped profiles -->
	{#if ungrouped.length > 0}
		<div class="section-label">Ungrouped</div>
		{#each ungrouped as profile}
			<div class="profile-card-standalone">
				<div class="profile-info">
					<span class="profile-name">{profile.name}</span>
					<span class="profile-meta">{profile.steps.length} step{profile.steps.length !== 1 ? 's' : ''}</span>
				</div>
				<div class="profile-actions">
					<a href="/profiles/{profile.id}/edit" class="icon-btn" title="Edit">&#9998;</a>
					<button class="icon-btn danger" onclick={() => deleteProfile(profile.id)} title="Delete">&#10005;</button>
				</div>
			</div>
		{/each}
	{/if}

	<!-- Create group -->
	<div class="create-section">
		<div class="section-label">New Group</div>
		<p class="hint">Group profiles that share the same origin & destination. The dashboard ranks routes in a group by fastest arrival.</p>
		<div class="create-row">
			<input type="text" bind:value={newGroupName} placeholder="e.g. Home → Work" />
			<button class="btn btn-primary btn-sm" onclick={createGroup}>Create</button>
		</div>
	</div>
</div>

<style>
	.page { padding-top: var(--space-sm); }

	.header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: var(--space-xl);
	}

	h2 { font-size: var(--text-2xl); font-weight: var(--weight-bold); }

	/* Group card */
	.group-card {
		background: var(--bg-card);
		border: 1px solid var(--border-default);
		border-radius: var(--radius-xl);
		padding: var(--space-lg);
		margin-bottom: var(--space-lg);
	}

	.group-top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: var(--space-md);
	}

	.group-info { display: flex; align-items: baseline; gap: var(--space-sm); }
	.group-name { font-size: var(--text-sm); font-weight: var(--weight-bold); }
	.group-count { font-size: var(--text-xs); color: var(--text-muted); }

	/* Profiles inside group */
	.group-profiles {
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
	}

	.profile-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: var(--space-sm) var(--space-md);
		background: var(--bg-elevated);
		border-radius: var(--radius-md);
	}

	.profile-info { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
	.profile-name { font-size: var(--text-sm); font-weight: var(--weight-medium); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
	.profile-meta { font-size: 10px; color: var(--text-muted); }

	.profile-actions {
		display: flex;
		gap: var(--space-xs);
		flex-shrink: 0;
	}

	/* Icon buttons */
	.icon-btn {
		width: 28px;
		height: 28px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: var(--radius-sm);
		font-size: var(--text-xs);
		color: var(--text-muted);
		transition: all var(--transition-fast);
		text-decoration: none;
	}

	.icon-btn:hover { color: var(--text-primary); background: var(--accent-muted); }
	.icon-btn.danger:hover { color: var(--status-urgent); background: var(--status-urgent-bg); }

	/* Add profile to group */
	.add-profile-btn {
		width: 100%;
		margin-top: var(--space-sm);
		padding: var(--space-sm);
		border: 1px dashed var(--border-default);
		border-radius: var(--radius-md);
		color: var(--text-muted);
		font-size: var(--text-xs);
		transition: all var(--transition-fast);
	}

	.add-profile-btn:hover {
		border-color: var(--accent);
		color: var(--accent);
		background: var(--accent-muted);
	}

	/* Add picker (inline list of ungrouped profiles) */
	.add-picker {
		margin-top: var(--space-sm);
		border: 1px solid var(--accent);
		border-radius: var(--radius-md);
		overflow: hidden;
	}

	.add-picker-label {
		display: block;
		padding: var(--space-sm) var(--space-md);
		font-size: var(--text-xs);
		color: var(--text-muted);
		background: var(--bg-elevated);
	}

	.add-picker-item {
		display: block;
		width: 100%;
		padding: var(--space-sm) var(--space-md);
		font-size: var(--text-sm);
		color: var(--text-primary);
		text-align: left;
		border-bottom: 1px solid var(--border-subtle);
		transition: background var(--transition-fast);
	}

	.add-picker-item:hover { background: var(--accent-muted); }

	.add-picker-cancel {
		display: block;
		width: 100%;
		padding: var(--space-sm) var(--space-md);
		font-size: var(--text-xs);
		color: var(--text-muted);
		text-align: center;
		transition: color var(--transition-fast);
	}

	.add-picker-cancel:hover { color: var(--text-primary); }

	/* Standalone ungrouped profile */
	.profile-card-standalone {
		display: flex;
		align-items: center;
		justify-content: space-between;
		background: var(--bg-card);
		border: 1px solid var(--border-default);
		border-radius: var(--radius-md);
		padding: var(--space-md) var(--space-lg);
		margin-bottom: var(--space-sm);
	}

	/* Section label */
	.section-label {
		font-size: var(--text-xs);
		font-weight: var(--weight-semibold);
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: 0.1em;
		margin-bottom: var(--space-sm);
		margin-top: var(--space-xl);
	}

	/* Create group */
	.create-section {
		margin-top: var(--space-xl);
		margin-bottom: var(--space-xl);
	}

	.hint {
		font-size: var(--text-xs);
		color: var(--text-muted);
		margin-bottom: var(--space-md);
		line-height: 1.4;
	}

	.create-row {
		display: flex;
		gap: var(--space-sm);
	}

	.create-row input { flex: 1; }

	/* Shared button styles */
	.btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		font-size: var(--text-sm);
		font-weight: var(--weight-semibold);
		border-radius: var(--radius-md);
		padding: var(--space-md) var(--space-xl);
		cursor: pointer;
		text-decoration: none;
		transition: all var(--transition-fast);
	}

	.btn-sm { font-size: var(--text-xs); padding: var(--space-sm) var(--space-lg); border-radius: var(--radius-sm); }
	.btn-primary { background: var(--accent); color: #fff; }
	.btn-primary:hover { background: var(--accent-hover); }
</style>
