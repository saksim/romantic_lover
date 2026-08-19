import type { Category, CategoryId } from '../domain/wish'

export const categories: Category[] = [
  {
    id: 'daily',
    name: '日常微光',
    shortName: '日常',
    eyebrow: 'Small days, big love',
    symbol: '○',
    color: '#9a5c65',
    softColor: '#f2dadd',
  },
  {
    id: 'adventure',
    name: '出走冒险',
    shortName: '冒险',
    eyebrow: 'Go somewhere new',
    symbol: '↗',
    color: '#4f766f',
    softColor: '#d9e8e1',
  },
  {
    id: 'romance',
    name: '心动仪式',
    shortName: '心动',
    eyebrow: 'Make it a memory',
    symbol: '♥',
    color: '#a84f63',
    softColor: '#f5d7dc',
  },
  {
    id: 'growth',
    name: '一起成长',
    shortName: '成长',
    eyebrow: 'Become, together',
    symbol: '✦',
    color: '#6b668d',
    softColor: '#e4e0ef',
  },
  {
    id: 'home',
    name: '我们的家',
    shortName: '家',
    eyebrow: 'A place called us',
    symbol: '⌂',
    color: '#9a7146',
    softColor: '#efe1cf',
  },
]

export const categoryMap = Object.fromEntries(
  categories.map((category) => [category.id, category]),
) as Record<CategoryId, Category>

