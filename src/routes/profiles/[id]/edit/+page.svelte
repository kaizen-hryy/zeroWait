<script lang="ts">
	import ProfileEditor from '$lib/components/ProfileEditor.svelte';

	let { data } = $props();
</script>

<h2 class="page-title">Edit Profile</h2>
<ProfileEditor
	profileId={data.profile.id}
	initialName={data.profile.name}
	initialGroupId={data.profile.groupId}
	initialSteps={data.profile.steps}
	groups={data.groups}
/>

<style>
	.page-title {
		font-size: var(--text-2xl);
		font-weight: var(--weight-bold);
		margin-bottom: var(--space-lg);
	}
</style>
