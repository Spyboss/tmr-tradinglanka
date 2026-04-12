import React, { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
  Empty,
  Row,
  Select,
  Space,
  Spin,
  Statistic,
  Table,
  Tag,
  Typography
} from 'antd';
import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  DownloadOutlined,
  MinusOutlined,
  PrinterOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import { format } from 'date-fns';
import { getInventoryReportAnalytics } from '../../services/inventoryService';
import apiClient from '../../config/apiClient';

const { Title, Text } = Typography;

const formatCurrency = (value = 0) => `Rs. ${Number(value || 0).toLocaleString()}`;
const formatSigned = (value = 0) => `${value > 0 ? '+' : ''}${value}`;
const formatPercent = (value = 0) => `${Math.abs(value * 100).toFixed(1)}%`;

const trendMeta = {
  increasing: {
    icon: <ArrowUpOutlined />,
    color: 'success',
    label: 'Increasing'
  },
  decreasing: {
    icon: <ArrowDownOutlined />,
    color: 'error',
    label: 'Decreasing'
  },
  stable: {
    icon: <MinusOutlined />,
    color: 'default',
    label: 'Stable'
  }
};

const severityColor = {
  warning: 'gold',
  high: 'orange',
  critical: 'red'
};

const InventoryReport = () => {
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState(null);
  const [reportDate] = useState(new Date());
  const [pdfSortMode, setPdfSortMode] = useState('date');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await getInventoryReportAnalytics();
      setAnalytics(response);
    } catch (error) {
      console.error('Error fetching inventory report analytics:', error);
      setAnalytics(null);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = async () => {
    try {
      const blob = await apiClient.get('/inventory/report/pdf', {
        params: { sortMode: pdfSortMode }
      });

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Gunawardhana_Motors_Inventory_Report_${format(reportDate, 'yyyy-MM-dd')}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error generating PDF:', error);
      window.print();
    }
  };

  const handleExport = () => {
    if (!analytics) return;

    const lines = [];
    const monthlyPerformance = analytics.monthlyPerformance || {};
    const months = analytics.salesByModelPerMonth?.months || [];
    const salesRows = analytics.salesByModelPerMonth?.rows || [];
    const stockPenaltyAlerts = analytics.stockPenaltyAlerts || [];
    const revenueSeries = analytics.revenueSeries || [];

    lines.push('Monthly Performance');
    lines.push('Metric,Value');
    lines.push(`Month,${monthlyPerformance.monthLabel || ''}`);
    lines.push(`Bikes Sold This Month,${monthlyPerformance.soldUnitsMTD || 0}`);
    lines.push(`Target Pace,${monthlyPerformance.targetUnits || 0}`);
    lines.push(`Expected By Today,${monthlyPerformance.expectedUnitsByToday || 0}`);
    lines.push(`Pace Gap,${monthlyPerformance.paceGap || 0}`);
    lines.push(`Projected Month End,${monthlyPerformance.projectedMonthEndUnits || 0}`);
    lines.push(`Revenue This Month,${monthlyPerformance.revenueMTD || 0}`);
    lines.push('');

    lines.push('Revenue By Month');
    lines.push('Month,Revenue');
    revenueSeries.forEach(item => {
      lines.push(`${item.label},${item.revenue}`);
    });
    lines.push('');

    lines.push('Bikes Sold By Model Per Month');
    lines.push(['Model', ...months.map(month => month.label), 'Total Sold'].join(','));
    salesRows.forEach(row => {
      lines.push([
        row.modelName,
        ...months.map(month => row.months?.[month.key] || 0),
        row.totalSold || 0
      ].join(','));
    });
    lines.push('');

    lines.push('3-Month Stock Penalty Alerts');
    lines.push('Model,Chassis Numbers,Aged Units,Oldest Age Days,Average Age Days,Value At Risk,Severity');
    stockPenaltyAlerts.forEach(item => {
      const chassisList = (item.chassisNumbers || []).join('; ');
      lines.push([
        item.modelName,
        `"${chassisList}"`,
        item.agedUnits || 0,
        item.oldestAgeDays || 0,
        item.averageAgeDays || 0,
        item.stockValueAtRisk || 0,
        item.severity || ''
      ].join(','));
    });

    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `inventory_report_dashboard_${format(reportDate, 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center dark:bg-slate-900">
        <Spin size="large" />
      </div>
    );
  }

  if (!analytics) {
    return (
      <Card>
        <Empty description="Inventory analytics could not be loaded." />
        <div className="mt-4 flex justify-center">
          <Button icon={<ReloadOutlined />} onClick={fetchData}>Retry</Button>
        </div>
      </Card>
    );
  }

  const monthlyPerformance = analytics.monthlyPerformance || {};
  const revenueSeries = analytics.revenueSeries || [];
  const salesByModel = analytics.salesByModelPerMonth || { months: [], rows: [], totals: [] };
  const stockPenaltyAlerts = analytics.stockPenaltyAlerts || [];
  const stockPenaltySummary = analytics.stockPenaltySummary || {};
  const unitTrend = trendMeta[monthlyPerformance.unitTrendDirection] || trendMeta.stable;
  const revenueTrend = trendMeta[monthlyPerformance.revenueTrendDirection] || trendMeta.stable;
  const topModel = salesByModel.currentMonthTopModel;

  const salesColumns = [
    {
      title: 'Model',
      dataIndex: 'modelName',
      key: 'modelName',
      fixed: 'left',
      width: 220,
      render: value => <Text strong>{value}</Text>
    },
    ...salesByModel.months.map(month => ({
      title: month.label,
      key: month.key,
      width: 120,
      align: 'right',
      render: (_, record) => record.months?.[month.key] || 0
    })),
    {
      title: 'Total Sold',
      dataIndex: 'totalSold',
      key: 'totalSold',
      width: 120,
      align: 'right',
      render: value => <Text strong>{value}</Text>
    }
  ];

  const stockPenaltyColumns = [
    {
      title: 'Model',
      dataIndex: 'modelName',
      key: 'modelName',
      width: 160,
      render: value => <Text strong>{value}</Text>
    },
    {
      title: 'Chassis Numbers',
      dataIndex: 'chassisNumbers',
      key: 'chassisNumbers',
      width: 220,
      render: (value = []) => (
        <Text type="secondary" className="text-xs">
          {value.slice(0, 3).join(', ')}
          {value.length > 3 && ` +${value.length - 3} more`}
        </Text>
      )
    },
    {
      title: 'Aged Units',
      dataIndex: 'agedUnits',
      key: 'agedUnits',
      width: 100,
      align: 'right'
    },
    {
      title: 'Oldest Age',
      dataIndex: 'oldestAgeDays',
      key: 'oldestAgeDays',
      width: 100,
      align: 'right',
      render: value => `${value} days`
    },
    {
      title: 'Average Age',
      dataIndex: 'averageAgeDays',
      key: 'averageAgeDays',
      width: 110,
      align: 'right',
      render: value => `${value} days`
    },
    {
      title: 'Value At Risk',
      dataIndex: 'stockValueAtRisk',
      key: 'stockValueAtRisk',
      width: 140,
      align: 'right',
      render: value => <Text strong>{formatCurrency(value)}</Text>
    },
    {
      title: 'Severity',
      dataIndex: 'severity',
      key: 'severity',
      width: 100,
      render: value => <Tag color={severityColor[value] || 'default'}>{String(value || '').toUpperCase()}</Tag>
    }
  ];

  return (
    <div className="space-y-6 inventory-report-container">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <Title level={2} className="!mb-1">Inventory Analytics Dashboard</Title>
          <Text type="secondary">
            Monthly sales pace, model-wise sold units, and 90+ day stock risk. The stock PDF print report remains unchanged.
          </Text>
        </div>
        <Space wrap>
          <Button icon={<ReloadOutlined />} onClick={fetchData}>Refresh</Button>
          <Select
            value={pdfSortMode}
            onChange={setPdfSortMode}
            style={{ width: 250 }}
            options={[
              { value: 'date', label: 'PDF Sort: Added Date' },
              { value: 'model', label: 'PDF Sort: Group by Bike Model' }
            ]}
          />
          <Button icon={<PrinterOutlined />} onClick={handlePrint}>Print Report</Button>
          <Button type="primary" icon={<DownloadOutlined />} onClick={handleExport}>Export CSV</Button>
        </Space>
      </div>

      <Card title="Monthly Target Progress + Revenue" bordered={false}>
        <Row gutter={[16, 16]}>
          <Col xs={24} md={12} xl={5}>
            <Card size="small">
              <Statistic title="Bikes Sold This Month" value={monthlyPerformance.soldUnitsMTD || 0} />
              <div className="mt-2 flex items-center gap-2">
                <Tag color={unitTrend.color} icon={unitTrend.icon}>{unitTrend.label}</Tag>
                <Text type="secondary">vs {monthlyPerformance.lastMonthSamePeriodUnits || 0} last month</Text>
              </div>
            </Card>
          </Col>
          <Col xs={24} md={12} xl={5}>
            <Card size="small">
              <Statistic title="Expected By Today" value={monthlyPerformance.expectedUnitsByToday || 0} precision={1} />
              <Text type="secondary">
                Pace is <Text strong>{formatSigned(monthlyPerformance.paceGap || 0)}</Text> bikes {monthlyPerformance.paceStatus || 'on-track'}
              </Text>
            </Card>
          </Col>
          <Col xs={24} md={12} xl={5}>
            <Card size="small">
              <Statistic title="Projected Month-End Sales" value={monthlyPerformance.projectedMonthEndUnits || 0} precision={1} />
              <Text type="secondary">Target benchmark: {monthlyPerformance.targetUnits || 25} bikes</Text>
            </Card>
          </Col>
          <Col xs={24} md={12} xl={5}>
            <Card size="small">
              <Statistic title="Revenue This Month" value={monthlyPerformance.revenueMTD || 0} formatter={value => formatCurrency(value)} />
              <div className="mt-2 flex items-center gap-2">
                <Tag color={revenueTrend.color} icon={revenueTrend.icon}>{revenueTrend.label}</Tag>
                <Text type="secondary">{formatPercent(monthlyPerformance.revenueTrendPercent || 0)} vs last month</Text>
              </div>
            </Card>
          </Col>
          <Col xs={24} md={12} xl={4}>
            <Card size="small">
              <Statistic title="90+ Day Stock Units" value={stockPenaltySummary.totalUnits || 0} />
              <Text type="secondary">Across {stockPenaltySummary.totalModels || 0} models</Text>
            </Card>
          </Col>
        </Row>

        <Row gutter={[16, 16]} className="mt-4">
          <Col xs={24} lg={16}>
            <Alert
              type={monthlyPerformance.paceStatus === 'ahead' ? 'success' : monthlyPerformance.paceStatus === 'behind' ? 'warning' : 'info'}
              showIcon
              message={`${monthlyPerformance.monthLabel}: ${monthlyPerformance.soldUnitsMTD || 0} bikes sold, projected ${(monthlyPerformance.projectedMonthEndUnits || 0).toFixed(1)} by month-end.`}
              description={topModel?.soldUnits
                ? `${topModel.modelName} is the top-selling model this month with ${topModel.soldUnits} units.`
                : 'No model sales recorded yet for this month.'}
            />
          </Col>
          <Col xs={24} lg={8}>
            <Card size="small" title="Revenue By Month">
              <Space direction="vertical" style={{ width: '100%' }} size={10}>
                {revenueSeries.map(item => (
                  <div key={item.monthKey} className="flex items-center justify-between">
                    <Text>{item.label}</Text>
                    <Text strong>{formatCurrency(item.revenue)}</Text>
                  </div>
                ))}
              </Space>
            </Card>
          </Col>
        </Row>
      </Card>

      <Card title="Bikes Sold By Model Per Month" bordered={false}>
        <Table
          columns={salesColumns}
          dataSource={salesByModel.rows.map(row => ({ ...row, key: row.modelId || row.modelName }))}
          pagination={false}
          size="small"
          locale={{ emptyText: 'No sold-bike data found for the last 6 months.' }}
          scroll={{ x: 980 }}
          summary={() => (
            <Table.Summary.Row>
              <Table.Summary.Cell index={0}><Text strong>Total</Text></Table.Summary.Cell>
              {salesByModel.months.map((month, index) => {
                const total = salesByModel.totals.find(item => item.monthKey === month.key)?.soldUnits || 0;
                return (
                  <Table.Summary.Cell key={month.key} index={index + 1} align="right">
                    <Text strong>{total}</Text>
                  </Table.Summary.Cell>
                );
              })}
              <Table.Summary.Cell index={salesByModel.months.length + 1} align="right">
                <Text strong>{salesByModel.rows.reduce((sum, row) => sum + (row.totalSold || 0), 0)}</Text>
              </Table.Summary.Cell>
            </Table.Summary.Row>
          )}
        />
      </Card>

      <Card
        title="3-Month Stock Penalty Alerts"
        extra={<Text type="secondary">Value at risk: {formatCurrency(stockPenaltySummary.totalValueAtRisk || 0)}</Text>}
        bordered={false}
      >
        {stockPenaltyAlerts.length === 0 ? (
          <Empty description="No available stock has crossed the 90-day threshold." />
        ) : (
          <Table
            columns={stockPenaltyColumns}
            dataSource={stockPenaltyAlerts.map(item => ({ ...item, key: item.modelId || item.modelName }))}
            pagination={false}
            size="small"
            scroll={{ x: 950 }}
          />
        )}
      </Card>
    </div>
  );
};

export default InventoryReport;
