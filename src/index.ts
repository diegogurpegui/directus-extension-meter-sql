import { definePanel } from '@directus/extensions';
import PanelMeter from './panel-meter.vue';

export default definePanel({
	id: 'dg-meter-sql',
	name: 'DG Meter SQL',
	description: 'Meter filled by the first value of a SQL query',
	icon: 'speed',
	component: PanelMeter,
	options: [
		{
			field: 'sqlQuery',
			type: 'string',
			name: 'SQL Query',
			meta: {
				interface: 'input-multiline',
				width: 'full',
				options: {
					placeholder: 'SELECT COUNT(*) FROM orders',
					font: 'monospace',
				},
				note: 'Uses the first column of the first row. Add LIMIT 1 when the query can return many rows.',
			},
		},
		{
			field: 'max',
			name: '$t:max',
			type: 'float',
			schema: {
				default_value: 100,
			},
			meta: {
				interface: 'input',
				width: 'half',
				options: {
					placeholder: '100',
					min: 0,
				},
			},
		},
		{
			field: 'size',
			type: 'string',
			name: '$t:size',
			meta: {
				interface: 'select-dropdown',
				width: 'half',
				options: {
					choices: [
						{
							value: 'full',
							text: '$t:full_circle',
						},
						{
							value: 'half',
							text: '$t:half_circle',
						},
					],
				},
			},
			schema: {
				default_value: 'full',
			},
		},
		{
			field: 'strokeWidth',
			type: 'integer',
			name: '$t:stroke_width',
			meta: {
				interface: 'select-dropdown',
				width: 'half',
				options: {
					choices: [
						{
							text: '$t:thin',
							value: 8,
						},
						{
							text: '$t:medium',
							value: 20,
						},
						{
							text: '$t:broad',
							value: 48,
						},
					],
				},
			},
			schema: {
				default_value: 20,
			},
		},
		{
			field: 'color',
			name: '$t:color',
			type: 'string',
			schema: {
				default_value: 'var(--theme--primary)',
			},
			meta: {
				interface: 'select-color',
				width: 'half',
			},
		},
		{
			field: 'roundedStroke',
			name: '$t:rounded_stroke',
			type: 'boolean',
			schema: {
				default_value: false,
			},
			meta: {
				interface: 'boolean',
				width: 'half',
			},
		},
		{
			field: 'showPercentage',
			name: '$t:show_percentage',
			type: 'boolean',
			schema: {
				default_value: true,
			},
			meta: {
				interface: 'boolean',
				width: 'half',
			},
		},
		{
			field: 'conditionalFill',
			type: 'json',
			name: '$t:conditional_styles',
			meta: {
				interface: 'list',
				width: 'full',
				options: {
					template: '{{color}} {{operator}} {{value}}',
					fields: [
						{
							field: 'operator',
							name: 'operators',
							type: 'string',
							schema: {
								default_value: '>=',
							},
							meta: {
								interface: 'select-dropdown',
								width: 'half',
								options: {
									choices: [
										{
											text: '$t:operators.eq',
											value: '=',
										},
										{
											text: '$t:operators.neq',
											value: '!=',
										},
										{
											text: '$t:operators.gt',
											value: '>',
										},
										{
											text: '$t:operators.gte',
											value: '>=',
										},
										{
											text: '$t:operators.lt',
											value: '<',
										},
										{
											text: '$t:operators.lte',
											value: '<=',
										},
									],
								},
							},
						},
						{
							field: 'value',
							name: '$t:value',
							type: 'string',
							meta: {
								interface: 'input',
								width: 'half',
							},
						},
						{
							field: 'color',
							name: '$t:color',
							type: 'string',
							schema: {
								default_value: 'var(--theme--primary)',
							},
							meta: {
								interface: 'select-color',
								display: 'color',
								width: 'half',
							},
						},
					],
				},
			},
		},
	],
	minWidth: 6,
	minHeight: 6,
});
