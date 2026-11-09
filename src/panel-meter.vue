<script setup lang="ts">
import { useApi } from '@directus/extensions-sdk';
import { computed, onUnmounted, ref, unref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

type ConditionalFill = {
	operator?: '=' | '!=' | '>' | '>=' | '<' | '<=' | string;
	color?: string;
	value?: number | string | null;
};

const props = withDefaults(
	defineProps<{
		showHeader?: boolean;
		width?: number;
		height?: number;
		now?: Date | string;
		sqlQuery?: string;
		size?: 'full' | 'half';
		strokeWidth?: number | string;
		roundedStroke?: boolean;
		showPercentage?: boolean;
		color?: string | null;
		max?: number | string;
		conditionalFill?: ConditionalFill[] | null;
	}>(),
	{
		showHeader: false,
		width: 6,
		height: 6,
		sqlQuery: '',
		size: 'full',
		strokeWidth: 20,
		roundedStroke: false,
		showPercentage: true,
		color: 'var(--theme--primary)',
		max: 100,
		conditionalFill: () => [],
	},
);

const { n } = useI18n();
const api = useApi();

const value = ref<number | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);

let requestId = 0;
let debounceTimer: ReturnType<typeof setTimeout> | undefined;

const stroke = computed(() => {
	const parsed = Number(props.strokeWidth);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : 20;
});

const maxValue = computed(() => {
	const parsed = Number(props.max);
	return Number.isFinite(parsed) ? parsed : 100;
});

const percent = computed(() => {
	if (value.value === null || maxValue.value === 0) return 0;
	return value.value / maxValue.value;
});

const visualPercent = computed(() => Math.min(Math.max(percent.value, 0), 1));

const displayValue = computed(() => {
	if (!props.showPercentage) return '';
	const percentDecimal = Number((unref(percent) * 100).toFixed(1));
	return n(percentDecimal) + '%';
});

const radius = computed(() => {
	const widthPx = (props.width ?? 6) * 20 - 24 - 4;
	let heightPx = (props.height ?? 6) * 20 - 24 - 4;

	if (props.showHeader) heightPx -= 42;

	const strokeOffset = stroke.value / 2;
	const minDimension = Math.min(widthPx, heightPx);

	const next =
		props.size === 'half' && heightPx < widthPx
			? Math.min(widthPx / 2 - strokeOffset, ((props.height ?? 6) * 30) / 2 - 12)
			: minDimension / 2 - strokeOffset;

	return Math.max(next, 0);
});

const svgSize = computed(() => {
	const width = unref(radius) * 2 + stroke.value;

	if (props.size === 'half') {
		return {
			width,
			height: unref(radius) + stroke.value,
		};
	}

	return {
		width,
		height: unref(radius) * 2 + stroke.value,
	};
});

const circumference = computed(() => unref(radius) * 2 * Math.PI);

const dashOffset = computed(() => {
	const full = unref(circumference) - unref(visualPercent) * unref(circumference);
	if (props.size === 'half') return full / 2;
	return full;
});

const dashArray = computed(() => `${unref(circumference)} ${unref(circumference)}`);
const dashOffsetValue = computed(() => String(unref(dashOffset)));

const conditionalColor = computed(() => {
	const defaultColor = props.color || 'var(--theme--primary)';
	const rules = props.conditionalFill ?? [];

	if (!rules.length || !Number.isFinite(percent.value)) return defaultColor;

	const percentValue = percent.value * 100;
	const match = rules.find((format) => {
		const compareValue = Number(format.value ?? 0);
		if (!Number.isFinite(compareValue)) return false;

		switch (format.operator || '>=') {
			case '=':
				return percentValue === compareValue;
			case '!=':
				return percentValue !== compareValue;
			case '>':
				return percentValue > compareValue;
			case '>=':
				return percentValue >= compareValue;
			case '<':
				return percentValue < compareValue;
			case '<=':
				return percentValue <= compareValue;
			default:
				return false;
		}
	});

	return match?.color || defaultColor;
});

const fontSize = computed(() => Math.min(Math.ceil(unref(circumference) / 100) * 7, 48) + 'px');
const halfSizeOutputOffset = computed(() => unref(radius) / 4 + stroke.value / 2 + 'px');

function refreshKey(now: Date | string | undefined): number | undefined {
	if (!now) return undefined;
	const time = now instanceof Date ? now.getTime() : new Date(now).getTime();
	return Number.isNaN(time) ? undefined : time;
}

/**
 * Loads the meter value from `/dg-meter-sql-query`.
 * Ignores stale responses when the query or dashboard refresh changes mid-request.
 */
async function fetchData() {
	const id = ++requestId;
	const query = props.sqlQuery?.trim() ?? '';

	if (!query) {
		value.value = null;
		error.value = null;
		loading.value = false;
		return;
	}

	loading.value = true;
	error.value = null;

	try {
		const response = await api.post('/dg-meter-sql-query', { query });
		if (id !== requestId) return;

		const body = response.data ?? {};
		if (body.error) {
			error.value = body.message || body.error;
			value.value = null;
			return;
		}

		const numeric = typeof body.value === 'number' ? body.value : Number(body.value);
		if (!Number.isFinite(numeric)) {
			error.value = 'Query did not return a numeric value';
			value.value = null;
			return;
		}

		value.value = numeric;
	} catch (err: unknown) {
		if (id !== requestId) return;
		const responseData = (err as { response?: { data?: { message?: string; error?: string } } }).response?.data;
		const message = err instanceof Error ? err.message : undefined;
		error.value = responseData?.message || responseData?.error || message || 'Error fetching data';
		value.value = null;
	} finally {
		if (id === requestId) loading.value = false;
	}
}

watch(
	() => [props.sqlQuery, refreshKey(props.now)] as const,
	() => {
		clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => {
			void fetchData();
		}, 250);
	},
	{ immediate: true },
);

onUnmounted(() => {
	clearTimeout(debounceTimer);
	requestId += 1;
});
</script>

<template>
	<div class="panel-meter" :class="[{ 'has-header': showHeader }, `size-${size}`]">
		<div v-if="!sqlQuery?.trim()" class="state">Configure a SQL query in the panel options.</div>
		<div v-else-if="loading && value === null" class="state">Loading...</div>
		<div v-else-if="error" class="state error">{{ error }}</div>
		<template v-else>
			<output>{{ displayValue }}</output>
			<svg :width="svgSize.width" :height="svgSize.height">
				<circle
					cx="50%"
					:cy="size === 'half' ? '100%' : '50%'"
					fill="none"
					:stroke-width="stroke"
					:stroke-linecap="roundedStroke ? 'round' : 'inherit'"
					:r="radius"
					stroke="var(--theme--background-subdued)"
				/>
				<circle
					cx="50%"
					:cy="size === 'half' ? '100%' : '50%'"
					fill="none"
					:stroke-width="stroke"
					:stroke-linecap="roundedStroke ? 'round' : 'inherit'"
					:r="radius"
					:stroke="conditionalColor"
				/>
			</svg>
		</template>
	</div>
</template>

<style scoped>
.panel-meter {
	inline-size: 100%;
	block-size: 100%;
	position: relative;
	padding: 0.6875rem;
	display: grid;
	place-items: center center;
	justify-content: center;
}

.panel-meter > * {
	grid-column: 1;
	grid-row: 1;
}

.panel-meter.has-header {
	padding-block-start: 0;
}

.panel-meter output {
	z-index: 1;
	font-weight: 800;
	font-size: v-bind(fontSize);
	line-height: 2.9375rem;
}

.panel-meter.size-half output {
	position: relative;
	inset-block-start: v-bind(halfSizeOutputOffset);
}

.panel-meter svg circle:last-child {
	transform-origin: center center;
	transform: rotate(-90deg);
	stroke-dasharray: v-bind(dashArray);
	stroke-dashoffset: v-bind(dashOffsetValue);
}

.panel-meter.size-half svg circle:last-child {
	transform-origin: bottom;
	transform: rotate(0deg);
}

.state {
	z-index: 1;
	padding: 12px;
	text-align: center;
	color: var(--theme--foreground-subdued);
	font-size: 14px;
}

.state.error {
	color: var(--theme--danger);
}
</style>
