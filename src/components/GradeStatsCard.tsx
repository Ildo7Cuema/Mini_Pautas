/*
component-meta:
  name: GradeStatsCard
  description: Statistics card for grade entry page
  tokens: [--color-primary, --fs-md]
  responsive: true
*/

import React from 'react'
import { Card, CardBody, CardHeader } from './ui/Card'
import { GradeStats } from '../utils/gradeUtils'
import { getQualitativeBands } from '../utils/angolaGradeScale'

interface GradeStatsCardProps {
    stats: GradeStats
    loading?: boolean
    nivelEnsino?: string | null
}

export const GradeStatsCard: React.FC<GradeStatsCardProps> = ({ stats, loading = false, nivelEnsino = null }) => {
    if (loading) {
        return (
            <Card>
                <CardBody className="p-4">
                    <div className="animate-pulse space-y-3">
                        <div className="h-4 bg-slate-200 rounded w-1/4"></div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {[1, 2, 3, 4].map(i => (
                                <div key={i} className="h-16 bg-slate-200 rounded"></div>
                            ))}
                        </div>
                    </div>
                </CardBody>
            </Card>
        )
    }

    const statItems = [
        {
            label: 'Total',
            value: stats.total,
            icon: '👥',
            color: 'bg-slate-50 border-slate-200',
            textColor: 'text-slate-900'
        },
        {
            label: 'Lançadas',
            value: stats.filled,
            icon: '✓',
            color: 'bg-green-50 border-green-200',
            textColor: 'text-green-900'
        },
        {
            label: 'Pendentes',
            value: stats.pending,
            icon: '⏳',
            color: 'bg-amber-50 border-amber-200',
            textColor: 'text-amber-900'
        },
        {
            label: 'Média',
            value: stats.average.toFixed(2),
            icon: '📊',
            color: 'bg-blue-50 border-blue-200',
            textColor: 'text-blue-900'
        },
        {
            label: 'Mínima',
            value: stats.min > 0 ? stats.min.toFixed(2) : '-',
            icon: '⬇️',
            color: 'bg-red-50 border-red-200',
            textColor: 'text-red-900'
        },
        {
            label: 'Máxima',
            value: stats.max > 0 ? stats.max.toFixed(2) : '-',
            icon: '⬆️',
            color: 'bg-emerald-50 border-emerald-200',
            textColor: 'text-emerald-900'
        },
        {
            label: 'Aprovados',
            value: stats.approved,
            icon: '🎓',
            color: 'bg-green-50 border-green-200',
            textColor: 'text-green-900'
        },
        {
            label: 'Taxa',
            value: `${stats.approvalRate}%`,
            icon: '📈',
            color: stats.approvalRate >= 70 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200',
            textColor: stats.approvalRate >= 70 ? 'text-green-900' : 'text-red-900'
        }
    ]

    return (
        <Card>
            <CardHeader>
                <h3 className="text-base md:text-lg font-semibold text-slate-900">Estatísticas</h3>
            </CardHeader>
            <CardBody className="p-3 md:p-4">
                {/* Main Stats Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 md:gap-3 mb-4">
                    {statItems.map((item, index) => (
                        <div
                            key={index}
                            className={`${item.color} border rounded-lg p-3 transition-all duration-200 hover:shadow-md`}
                        >
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-xs text-slate-600 font-medium">{item.label}</span>
                                <span className="text-lg">{item.icon}</span>
                            </div>
                            <div className={`text-xl md:text-2xl font-bold ${item.textColor}`}>
                                {item.value}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Distribution Chart */}
                {stats.filled > 0 && (
                    <div className="mt-4 pt-4 border-t border-slate-200">
                        <h4 className="text-sm font-semibold text-slate-700 mb-3">Distribuição de Classificações</h4>
                        <div className="space-y-2">
                            {(() => {
                                const bands = getQualitativeBands(nivelEnsino)
                                return [
                                { label: bands.labels.excellent, value: stats.distribution.excellent, color: 'bg-green-500', total: stats.filled },
                                { label: bands.labels.good, value: stats.distribution.good, color: 'bg-blue-500', total: stats.filled },
                                { label: bands.labels.sufficient, value: stats.distribution.sufficient, color: 'bg-yellow-500', total: stats.filled },
                                { label: bands.labels.insufficient, value: stats.distribution.insufficient, color: 'bg-red-500', total: stats.filled }
                            ]
                            })().map((dist, index) => {
                                const percentage = stats.filled > 0 ? (dist.value / dist.total) * 100 : 0
                                return (
                                    <div key={index}>
                                        <div className="flex items-center justify-between text-xs md:text-sm mb-1">
                                            <span className="text-slate-700">{dist.label}</span>
                                            <span className="font-semibold text-slate-900">
                                                {dist.value} ({percentage.toFixed(1)}%)
                                            </span>
                                        </div>
                                        <div className="w-full bg-slate-200 rounded-full h-2">
                                            <div
                                                className={`${dist.color} h-2 rounded-full transition-all duration-500`}
                                                style={{ width: `${percentage}%` }}
                                            />
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )}
            </CardBody>
        </Card>
    )
}
