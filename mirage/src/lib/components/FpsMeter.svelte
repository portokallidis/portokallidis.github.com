<script lang="ts">
  let { label, value }: { label: string; value: number } = $props();
</script>

<span class="fps-pill" title={`${label} throughput`}>
  <span>{label}</span>
  <strong>{Math.max(0, Math.round(value))}</strong>
  <span>fps</span>
</span>
