import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { PieChart as PieChartIcon, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';

interface CtamCategory {
  id: string;
  code: string;
  name_th: string;
  order_number: number;
}

interface BudgetRecord {
  id: string;
  hospital_id: string | null;
  health_office_id: string | null;
  fiscal_year: number;
  category_id: string;
  budget_amount: number;
}

interface BudgetPieChartProps {
  categories: CtamCategory[];
  budgetRecords: BudgetRecord[];
  selectedFiscalYear?: number;
  title?: string;
}

interface PieData {
  name: string;
  value: number;
  color: string;
  categoryId: string;
}

// Color palette for 17 categories
const CATEGORY_COLORS = [
  '#3B82F6', '#22C55E', '#EF4444', '#F59E0B', '#8B5CF6',
  '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1',
  '#14B8A6', '#A855F7', '#EAB308', '#0EA5E9', '#D946EF',
  '#10B981', '#FB7185',
];

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('th-TH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

export function BudgetPieChart({ 
  categories,
  budgetRecords, 
  selectedFiscalYear,
  title = 'สัดส่วนงบประมาณตามหมวดหมู่ CTAM',
}: BudgetPieChartProps) {
  const [tableSortOrder, setTableSortOrder] = useState<'default' | 'desc' | 'asc'>('default');
  // Aggregate by category
  const pieData = useMemo((): PieData[] => {
    const categoryTotals = new Map<string, number>();
    
    budgetRecords.forEach(record => {
      const current = categoryTotals.get(record.category_id) || 0;
      categoryTotals.set(record.category_id, current + (Number(record.budget_amount) || 0));
    });

    // Sort by order_number and create pie data
    return categories
      .sort((a, b) => a.order_number - b.order_number)
      .map((cat, index) => ({
        name: `${cat.order_number}. ${cat.name_th}`,
        value: categoryTotals.get(cat.id) || 0,
        color: CATEGORY_COLORS[index % CATEGORY_COLORS.length],
        categoryId: cat.id,
      }))
      .filter(d => d.value > 0); // Only show categories with budget
  }, [budgetRecords, categories]);

  const totalBudget = pieData.reduce((sum, d) => sum + d.value, 0);

  const sortedTableData = useMemo(() => {
    if (tableSortOrder === 'default') return pieData;
    return [...pieData].sort((a, b) =>
      tableSortOrder === 'desc' ? b.value - a.value : a.value - b.value
    );
  }, [pieData, tableSortOrder]);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const percentage = totalBudget > 0 ? ((data.value / totalBudget) * 100).toFixed(1) : '0';
      return (
        <div className="bg-background border rounded-lg p-3 shadow-lg max-w-xs">
          <p className="font-medium text-sm">{data.name}</p>
          <p className="text-primary text-sm">
            งบประมาณ: <span className="font-bold">{formatCurrency(data.value)}</span> บาท
          </p>
          <p className="text-muted-foreground text-sm">
            สัดส่วน: <span className="font-bold">{percentage}%</span>
          </p>
        </div>
      );
    }
    return null;
  };

  // Custom label with colored line and category name
  const renderCustomLabel = ({
    cx,
    cy,
    midAngle,
    outerRadius,
    percent,
    index,
  }: any) => {
    const RADIAN = Math.PI / 180;
    const percentage = (percent * 100).toFixed(0);
    const categoryName = pieData[index]?.name || '';
    
    // Don't show label if too small
    if (percent < 0.02) return null;
    
    // Calculate positions for the label line
    const sin = Math.sin(-midAngle * RADIAN);
    const cos = Math.cos(-midAngle * RADIAN);
    
    // Start point (on the pie edge)
    const sx = cx + outerRadius * cos;
    const sy = cy + outerRadius * sin;
    
    // Middle point (elbow)
    const mx = cx + (outerRadius + 25) * cos;
    const my = cy + (outerRadius + 25) * sin;
    
    // End point (where text starts)
    const ex = mx + (cos >= 0 ? 1 : -1) * 30;
    const ey = my;
    
    const textAnchor = cos >= 0 ? 'start' : 'end';
    const color = pieData[index]?.color || '#666';
    
    return (
      <g>
        {/* Line from pie to elbow */}
        <path
          d={`M${sx},${sy}L${mx},${my}L${ex},${ey}`}
          stroke={color}
          strokeWidth={1.5}
          fill="none"
        />
        {/* Small circle at the end */}
        <circle cx={ex} cy={ey} r={2} fill={color} />
        {/* Percentage and category name */}
        <text
          x={ex + (cos >= 0 ? 8 : -8)}
          y={ey}
          textAnchor={textAnchor}
          dominantBaseline="central"
          fill={color}
          fontSize={12}
          fontWeight="600"
        >
          {percentage}% {categoryName}
        </text>
      </g>
    );
  };

  const fiscalYearLabel = selectedFiscalYear 
    ? `(ปีงบประมาณ ${selectedFiscalYear})` 
    : '';

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <PieChartIcon className="w-5 h-5" />
            {title} {fiscalYearLabel}
          </CardTitle>
        </div>
        <p className="text-sm text-muted-foreground">
          งบประมาณรวม: <span className="font-bold text-primary">{formatCurrency(totalBudget)}</span> บาท
        </p>
      </CardHeader>
      <CardContent>
        {pieData.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">ไม่พบข้อมูลงบประมาณ</div>
        ) : (
          <div className="h-[450px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={130}
                  paddingAngle={1}
                  dataKey="value"
                  label={renderCustomLabel}
                  labelLine={false}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Category breakdown table */}
        {pieData.length > 0 && (
          <div className="mt-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
              <h4 className="font-medium">รายละเอียดงบประมาณแต่ละหมวดหมู่</h4>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground whitespace-nowrap">เรียงลำดับ:</span>
                <div className="inline-flex rounded-full border border-primary/30 overflow-hidden">
                  <button
                    onClick={() => setTableSortOrder('default')}
                    className={`inline-flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium transition-colors whitespace-nowrap ${
                      tableSortOrder === 'default'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-background text-primary hover:bg-primary/10'
                    }`}
                  >
                    <ArrowUpDown className="w-3.5 h-3.5" />
                    ตามลำดับข้อ
                  </button>
                  <button
                    onClick={() => setTableSortOrder('desc')}
                    className={`inline-flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium transition-colors border-x border-primary/30 whitespace-nowrap ${
                      tableSortOrder === 'desc'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-background text-primary hover:bg-primary/10'
                    }`}
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                    มากไปน้อย
                  </button>
                  <button
                    onClick={() => setTableSortOrder('asc')}
                    className={`inline-flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium transition-colors whitespace-nowrap ${
                      tableSortOrder === 'asc'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-background text-primary hover:bg-primary/10'
                    }`}
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                    น้อยไปมาก
                  </button>
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-2">หมวดหมู่</th>
                    <th className="text-right py-2 px-2">งบประมาณ (บาท)</th>
                    <th className="text-right py-2 px-2">สัดส่วน</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedTableData.map((item) => (
                    <tr key={item.categoryId} className="border-b hover:bg-muted/50">
                      <td className="py-2 px-2 flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-sm flex-shrink-0" 
                          style={{ backgroundColor: item.color }} 
                        />
                        {item.name}
                      </td>
                      <td className="text-right py-2 px-2 font-mono">
                        {formatCurrency(item.value)}
                      </td>
                      <td className="text-right py-2 px-2 text-muted-foreground">
                        {totalBudget > 0 ? ((item.value / totalBudget) * 100).toFixed(1) : 0}%
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="font-bold bg-muted/30">
                    <td className="py-2 px-2">รวมทั้งหมด</td>
                    <td className="text-right py-2 px-2 font-mono">{formatCurrency(totalBudget)}</td>
                    <td className="text-right py-2 px-2">100%</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
