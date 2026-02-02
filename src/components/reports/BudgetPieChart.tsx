import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { PieChart as PieChartIcon } from 'lucide-react';

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

  const renderCustomLegend = (props: any) => {
    const { payload } = props;
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-xs max-h-[200px] overflow-y-auto">
        {payload.map((entry: any, index: number) => (
          <div key={`legend-${index}`} className="flex items-center gap-2">
            <div 
              className="w-3 h-3 rounded-sm flex-shrink-0" 
              style={{ backgroundColor: entry.color }} 
            />
            <span className="truncate">{entry.value}</span>
          </div>
        ))}
      </div>
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
          <div className="h-[400px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={120}
                  paddingAngle={2}
                  dataKey="value"
                  label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend 
                  content={renderCustomLegend}
                  wrapperStyle={{ paddingTop: '20px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Category breakdown table */}
        {pieData.length > 0 && (
          <div className="mt-6">
            <h4 className="font-medium mb-3">รายละเอียดงบประมาณแต่ละหมวดหมู่</h4>
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
                  {pieData.map((item) => (
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
