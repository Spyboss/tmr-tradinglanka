import React, { useState, useEffect } from 'react';
import { Card, Spin, Statistic, Table, Tag, Button, Row, Col, Divider, Progress, Alert, Typography } from 'antd';
import { DownloadOutlined, PrinterOutlined, ReloadOutlined, ArrowUpOutlined, ArrowDownOutlined, WarningOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { getInventorySummary, getInventoryAnalytics } from '../../services/inventoryService';
import apiClient from '../../config/apiClient';
import { format } from 'date-fns';

const { Title, Text, Paragraph } = Typography;

const statusColors = {
  available: 'green',
  sold: 'blue',
  reserved: 'orange',
  damaged: 'red'
};

const InventoryReport = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState([]);
  const [statusTotals, setStatusTotals] = useState([]);
  const [inventoryValue, setInventoryValue] = useState({ totalValue: 0, count: 0 });
  const [analytics, setAnalytics] = useState(null);
  const [reportDate] = useState(new Date());

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Always fetch the basic summary first (existing functionality)
      const summaryResponse = await getInventorySummary();
      setSummary(summaryResponse.summary);
      setStatusTotals(summaryResponse.statusTotals);
      setInventoryValue(summaryResponse.inventoryValue);

      // Try to fetch analytics, but don't fail if it's not available
      try {
        const analyticsResponse = await getInventoryAnalytics();
        setAnalytics(analyticsResponse);
      } catch (analyticsError) {
        console.warn('Analytics endpoint not available, using basic report:', analyticsError);
        setAnalytics(null); // Fallback to basic report
      }
    } catch (error) {
      console.error('Error fetching inventory data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = async () => {
    try {
      // Use apiClient which handles authentication properly
      const blob = await apiClient.get('/inventory/report/pdf');

      // Create a URL for the blob
      const url = window.URL.createObjectURL(blob);

      // Create a temporary link and click it to download
      const link = document.createElement('a');
      link.href = url;
      link.download = `Gunawardhana_Motors_Inventory_Report_${format(reportDate, 'yyyy-MM-dd')}.pdf`;
      document.body.appendChild(link);
      link.click();

      // Clean up
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

    } catch (error) {
      console.error('Error generating PDF:', error);
      // Fallback to browser print if PDF generation fails
      window.print();
    }
  };

  const handleExport = () => {
    // Create CSV content
    const headers = ['Model Name', 'Price', 'Available', 'Sold', 'Reserved', 'Damaged', 'Total'];

    const rows = summary.map(item => {
      const available = item.statusCounts.find(s => s.status === 'available')?.count || 0;
      const sold = item.statusCounts.find(s => s.status === 'sold')?.count || 0;
      const reserved = item.statusCounts.find(s => s.status === 'reserved')?.count || 0;
      const damaged = item.statusCounts.find(s => s.status === 'damaged')?.count || 0;

      return [
        item.modelName,
        item.price,
        available,
        sold,
        reserved,
        damaged,
        item.totalCount
      ];
    });

    // Add totals row
    const totalAvailable = statusTotals.find(s => s.status === 'available')?.count || 0;
    const totalSold = statusTotals.find(s => s.status === 'sold')?.count || 0;
    const totalReserved = statusTotals.find(s => s.status === 'reserved')?.count || 0;
    const totalDamaged = statusTotals.find(s => s.status === 'damaged')?.count || 0;
    const grandTotal = totalAvailable + totalSold + totalReserved + totalDamaged;

    rows.push([
      'TOTAL',
      inventoryValue.totalValue,
      totalAvailable,
      totalSold,
      totalReserved,
      totalDamaged,
      grandTotal
    ]);

    // Convert to CSV
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `inventory_report_${format(reportDate, 'yyyy-MM-dd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Enhanced columns for professional reporting
  const enhancedColumns = [
    {
      title: 'Model',
      dataIndex: 'modelName',
      key: 'modelName',
      width: 200,
      render: (text, record) => (
        <div>
          <Text strong>{text}</Text>
          <div className="model-tags">
            {record.isEbicycle && <Tag color="cyan" size="small">E-Bicycle</Tag>}
            {record.isTricycle && <Tag color="purple" size="small">Tricycle</Tag>}
          </div>
        </div>
      )
    },
    {
      title: 'Unit Price',
      dataIndex: 'price',
      key: 'price',
      width: 120,
      render: (price) => <Text strong>Rs. {price?.toLocaleString() || 0}</Text>
    },
    {
      title: 'Inventory Status',
      key: 'status',
      width: 200,
      render: (_, record) => {
        const available = record.statusCounts?.find(s => s.status === 'available')?.count || 0;
        const sold = record.statusCounts?.find(s => s.status === 'sold')?.count || 0;
        const reserved = record.statusCounts?.find(s => s.status === 'reserved')?.count || 0;
        const damaged = record.statusCounts?.find(s => s.status === 'damaged')?.count || 0;

        return (
          <div className="status-tags">
            <Tag color="green">{available} Available</Tag>
            <Tag color="blue">{sold} Sold</Tag>
            {reserved > 0 && <Tag color="orange">{reserved} Reserved</Tag>}
            {damaged > 0 && <Tag color="red">{damaged} Damaged</Tag>}
          </div>
        );
      }
    },
    {
      title: 'Revenue',
      key: 'revenue',
      width: 120,
      render: (_, record) => {
        const sold = record.statusCounts?.find(s => s.status === 'sold')?.count || 0;
        const revenue = sold * record.price;
        return <Text strong style={{ color: '#1890ff' }}>Rs. {revenue.toLocaleString()}</Text>;
      }
    },
    {
      title: 'Performance',
      key: 'performance',
      width: 150,
      render: (_, record) => {
        const sold = record.statusCounts?.find(s => s.status === 'sold')?.count || 0;
        const total = record.totalCount || 0;
        const sellThrough = total > 0 ? (sold / total * 100) : 0;

        return (
          <div>
            <Progress
              percent={sellThrough}
              size="small"
              status={sellThrough > 50 ? 'success' : sellThrough > 25 ? 'normal' : 'exception'}
              format={() => `${sellThrough.toFixed(0)}%`}
            />
            <Text type="secondary" style={{ fontSize: '12px' }}>Sell-through Rate</Text>
          </div>
        );
      }
    }
  ];

  // Professional print-optimized columns
  const printColumns = [
    {
      title: 'Model Name',
      dataIndex: 'modelName',
      key: 'modelName',
      width: '25%',
      render: (text, record) => (
        <div>
          <Text strong style={{ fontSize: '10px', fontWeight: 'bold' }}>{text}</Text>
          {(record.isEbicycle || record.isTricycle) && (
            <div style={{ marginTop: '2px' }}>
              {record.isEbicycle && <Tag color="cyan" size="small" style={{ fontSize: '8px', padding: '2px 6px' }}>E-Bike</Tag>}
              {record.isTricycle && <Tag color="purple" size="small" style={{ fontSize: '8px', padding: '2px 6px' }}>Tricycle</Tag>}
            </div>
          )}
        </div>
      )
    },
    {
      title: 'Unit Price',
      dataIndex: 'price',
      key: 'price',
      width: '15%',
      render: (price) => <Text strong style={{ fontSize: '10px' }}>Rs. {price?.toLocaleString() || 0}</Text>
    },
    {
      title: 'Available',
      key: 'available',
      width: '12%',
      render: (_, record) => {
        const available = analytics?.modelPerformance ?
          record.availableUnits :
          record.statusCounts?.find(s => s.status === 'available')?.count || 0;
        return <Text strong style={{ fontSize: '10px', color: '#52c41a' }}>{available}</Text>;
      }
    },
    {
      title: 'Sold',
      key: 'sold',
      width: '12%',
      render: (_, record) => {
        const sold = analytics?.modelPerformance ?
          record.soldUnits :
          record.statusCounts?.find(s => s.status === 'sold')?.count || 0;
        return <Text strong style={{ fontSize: '10px', color: '#1890ff' }}>{sold}</Text>;
      }
    },
    {
      title: 'Total Revenue',
      key: 'revenue',
      width: '18%',
      render: (_, record) => {
        const revenue = analytics?.modelPerformance ?
          record.soldValue :
          (record.statusCounts?.find(s => s.status === 'sold')?.count || 0) * record.price;
        return <Text strong style={{ fontSize: '10px', color: '#722ed1' }}>Rs. {revenue?.toLocaleString() || 0}</Text>;
      }
    },
    {
      title: 'Sell-Through Rate',
      key: 'performance',
      width: '18%',
      render: (_, record) => {
        const sellThrough = analytics?.modelPerformance ?
          record.sellThroughRate :
          record.totalCount > 0 ? ((record.statusCounts?.find(s => s.status === 'sold')?.count || 0) / record.totalCount * 100) : 0;

        return (
          <div style={{ textAlign: 'center' }}>
            <Progress
              percent={sellThrough}
              size="small"
              status={sellThrough > 50 ? 'success' : sellThrough > 25 ? 'normal' : 'exception'}
              style={{ fontSize: '8px', marginBottom: '2px' }}
            />
            <Text strong style={{ fontSize: '10px' }}>{sellThrough.toFixed(1)}%</Text>
          </div>
        );
      }
    }
  ];

  // Analytics-enhanced columns when analytics data is available (for screen)
  const analyticsColumns = analytics?.modelPerformance ? [
    {
      title: 'Model',
      dataIndex: 'modelName',
      key: 'modelName',
      width: 180,
      render: (text, record) => (
        <div>
          <Text strong>{text}</Text>
          <div className="model-tags">
            {record.isEbicycle && <Tag color="cyan" size="small">E-Bicycle</Tag>}
            {record.isTricycle && <Tag color="purple" size="small">Tricycle</Tag>}
          </div>
        </div>
      )
    },
    {
      title: 'Price',
      dataIndex: 'price',
      key: 'price',
      width: 100,
      render: (price) => `Rs. ${price?.toLocaleString() || 0}`
    },
    {
      title: 'Stock Status',
      key: 'stock',
      width: 120,
      render: (_, record) => (
        <div>
          <div><Text>Available: <Text strong style={{ color: '#52c41a' }}>{record.availableUnits}</Text></Text></div>
          <div><Text>Sold: <Text strong style={{ color: '#1890ff' }}>{record.soldUnits}</Text></Text></div>
        </div>
      )
    },
    {
      title: 'Revenue',
      dataIndex: 'soldValue',
      key: 'revenue',
      width: 120,
      render: (value) => <Text strong style={{ color: '#722ed1' }}>Rs. {value?.toLocaleString() || 0}</Text>
    },
    {
      title: 'Performance',
      key: 'performance',
      width: 120,
      render: (_, record) => (
        <div>
          <Progress
            percent={record.sellThroughRate || 0}
            size="small"
            status={record.sellThroughRate > 50 ? 'success' : record.sellThroughRate > 25 ? 'normal' : 'exception'}
          />
          <Text type="secondary" style={{ fontSize: '11px' }}>{(record.sellThroughRate || 0).toFixed(1)}% Sell-through</Text>
        </div>
      )
    },
    {
      title: 'Stock Health',
      dataIndex: 'stockHealth',
      key: 'stockHealth',
      width: 100,
      render: (health) => {
        const color = health === 'Fast Moving' ? 'success' : health === 'Slow Moving' ? 'warning' : 'default';
        const icon = health === 'Fast Moving' ? <ArrowUpOutlined /> :
                    health === 'Slow Moving' ? <ArrowDownOutlined /> : null;
        return <Tag color={color} icon={icon}>{health}</Tag>;
      }
    }
  ] : enhancedColumns;

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64 dark:bg-slate-900">
        <Spin size="large" />
      </div>
    );
  }

  // Enhanced export function with analytics data
  const handleExportAnalytics = () => {
    if (!analytics) return;

    const headers = ['Model Name', 'Price', 'Total Units', 'Available', 'Sold', 'Reserved', 'Damaged', 'Revenue', 'Sell-Through %', 'Stock Health'];

    const rows = analytics.modelPerformance.map(item => [
      item.modelName,
      item.price,
      item.totalUnits,
      item.availableUnits,
      item.soldUnits,
      item.reservedUnits,
      item.damagedUnits,
      item.soldValue,
      item.sellThroughRate.toFixed(1),
      item.stockHealth
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `inventory-analytics-${format(reportDate, 'yyyy-MM-dd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="inventory-report-container">
      {/* Screen Controls */}
      <div className="flex justify-between items-center mb-6 print:hidden">
        <h1 className="text-2xl font-semibold">Professional Inventory Report</h1>
        <div className="space-x-2">
          <Button
            icon={<ReloadOutlined />}
            onClick={fetchData}
          >
            Refresh
          </Button>
          <Button
            icon={<PrinterOutlined />}
            onClick={handlePrint}
          >
            Print Report
          </Button>
          <Button
            type="primary"
            icon={<DownloadOutlined />}
            onClick={handleExportAnalytics}
          >
            Export Analytics
          </Button>
        </div>
      </div>

      {/* Professional Print Layout */}
      <div className="professional-report print:block">
        {/* Header Section */}
        <div className="report-header text-center mb-8 print:mb-6">
          <div className="company-logo-section mb-4">
            <Title level={1} className="company-name !mb-1">TMR Trading Lanka</Title>
            <Text className="company-subtitle">Premium Electric Vehicle Solutions</Text>
          </div>
          <Divider className="!my-4" />
          <div className="report-title-section">
            <Title level={2} className="report-title !mb-2">Inventory Analysis Report</Title>
            <Text className="report-date">Generated on: {format(reportDate, 'EEEE, MMMM do, yyyy \'at\' HH:mm')}</Text>
          </div>
        </div>

        {/* Executive Summary */}
        <div className="executive-summary mb-8 print:mb-6">
          <Title level={3} className="section-title !mb-4">Executive Summary</Title>
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={12} lg={6}>
              <Card className="kpi-card" size="small">
                <Statistic
                  title="Total Inventory Value"
                  value={analytics?.kpis?.totalInventoryValue || inventoryValue.totalValue}
                  prefix="Rs. "
                  precision={0}
                  valueStyle={{ color: '#1890ff', fontSize: '24px', fontWeight: 'bold' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card className="kpi-card" size="small">
                <Statistic
                  title="Available Units"
                  value={analytics?.kpis?.availableUnits || statusTotals.find(s => s.status === 'available')?.count || 0}
                  valueStyle={{ color: '#52c41a', fontSize: '24px', fontWeight: 'bold' }}
                  suffix={<CheckCircleOutlined />}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card className="kpi-card" size="small">
                <Statistic
                  title="Monthly Sales"
                  value={analytics?.kpis?.recentSales || 0}
                  valueStyle={{ color: '#722ed1', fontSize: '24px', fontWeight: 'bold' }}
                  suffix={<ArrowUpOutlined />}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card className="kpi-card" size="small">
                <Statistic
                  title="Turnover Rate"
                  value={analytics?.kpis?.inventoryTurnoverRate ? (analytics.kpis.inventoryTurnoverRate * 100).toFixed(1) : 0}
                  suffix="%"
                  valueStyle={{
                    color: analytics?.kpis?.inventoryTurnoverRate > 0.3 ? '#52c41a' : '#faad14',
                    fontSize: '24px',
                    fontWeight: 'bold'
                  }}
                />
              </Card>
            </Col>
          </Row>
        </div>

        {/* Actionable Insights - Dark mode compatible */}
        {analytics?.insights && analytics.insights.length > 0 && (
          <div className="insights-section mb-4 print:mb-3">
            <Title level={4} className="section-title !mb-2" style={{ fontSize: '12px', marginBottom: '8px' }}>
              📊 Action Items
            </Title>
            <div className="insights-compact">
              {analytics.insights.slice(0, 3).map((insight, index) => {
                // Dark mode compatible colors
                const getInsightColors = (type) => {
                  const isDark = document.documentElement.classList.contains('dark');

                  if (type === 'success') {
                    return {
                      bg: isDark ? '#1f4e1f' : '#f6ffed',
                      border: isDark ? '#52c41a' : '#b7eb8f',
                      text: isDark ? '#ffffff' : '#000000'
                    };
                  } else if (type === 'warning') {
                    return {
                      bg: isDark ? '#4d3800' : '#fffbe6',
                      border: isDark ? '#faad14' : '#ffe58f',
                      text: isDark ? '#ffffff' : '#000000'
                    };
                  } else {
                    return {
                      bg: isDark ? '#4d1f1f' : '#fff2f0',
                      border: isDark ? '#ff4d4f' : '#ffccc7',
                      text: isDark ? '#ffffff' : '#000000'
                    };
                  }
                };

                const colors = getInsightColors(insight.type);

                return (
                  <div key={index} className="insight-item dark-mode-insight" style={{
                    fontSize: '9px',
                    marginBottom: '4px',
                    padding: '4px 8px',
                    backgroundColor: colors.bg,
                    border: `1px solid ${colors.border}`,
                    borderRadius: '3px',
                    color: colors.text
                  }}>
                    <Text strong style={{ fontSize: '9px', color: colors.text }}>
                      {insight.type === 'success' ? '✅' : insight.type === 'warning' ? '⚠️' : '🚨'} {insight.title}:
                    </Text>
                    <Text style={{ fontSize: '8px', marginLeft: '4px', color: colors.text }}>{insight.message}</Text>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Enhanced Category Performance with Monthly Metrics */}
        {analytics?.categoryBreakdown && (
          <div className="category-section mb-8 print:mb-6 print:hidden">
            <Title level={3} className="section-title !mb-4">Category Performance - Monthly Analysis</Title>
            <Row gutter={16}>
              {analytics.categoryBreakdown.map((category, index) => (
                <Col xs={24} sm={8} key={index}>
                  <Card size="small" className="category-card">
                    <div className="text-center">
                      <Title level={4} className="!mb-2">{category.category}</Title>

                      {/* Stock Overview */}
                      <div className="category-stats mb-3">
                        <div className="stat-item">
                          <Text strong>Total Units: </Text>
                          <Text>{category.count}</Text>
                        </div>
                        <div className="stat-item">
                          <Text strong>Available: </Text>
                          <Text style={{ color: '#52c41a' }}>{category.available}</Text>
                        </div>
                        <div className="stat-item">
                          <Text strong>Sold: </Text>
                          <Text style={{ color: '#1890ff' }}>{category.sold}</Text>
                        </div>
                      </div>

                      {/* Monthly Performance */}
                      <Divider style={{ margin: '8px 0' }} />
                      <div className="monthly-performance">
                        <Text strong style={{ fontSize: '12px', color: '#722ed1' }}>
                          Monthly Performance (Last 30 Days)
                        </Text>
                        <div className="stat-item">
                          <Text strong>Arrivals: </Text>
                          <Text style={{ color: '#52c41a' }}>{category.monthlyArrivals || 0}</Text>
                        </div>
                        <div className="stat-item">
                          <Text strong>Sales: </Text>
                          <Text style={{ color: '#1890ff' }}>{category.monthlySales || 0}</Text>
                        </div>
                        <div className="stat-item">
                          <Text strong>Turnover Rate: </Text>
                          <Text style={{
                            color: (category.monthlyTurnoverRate || 0) > 50 ? '#52c41a' :
                                   (category.monthlyTurnoverRate || 0) > 25 ? '#faad14' : '#ff4d4f',
                            fontWeight: 'bold'
                          }}>
                            {(category.monthlyTurnoverRate || 0).toFixed(1)}%
                          </Text>
                        </div>
                        <div className="stat-item">
                          <Text strong>Avg. Days to Sell: </Text>
                          <Text style={{
                            color: (category.avgDaysToSell || 0) < 30 ? '#52c41a' :
                                   (category.avgDaysToSell || 0) < 60 ? '#faad14' : '#ff4d4f'
                          }}>
                            {category.avgDaysToSell || 'N/A'} days
                          </Text>
                        </div>
                      </div>

                      {/* Performance Indicator */}
                      <div className="performance-indicator mt-2">
                        <Progress
                          percent={category.sellThroughRate || 0}
                          size="small"
                          status={
                            (category.sellThroughRate || 0) > 50 ? 'success' :
                            (category.sellThroughRate || 0) > 25 ? 'normal' : 'exception'
                          }
                          format={() => `${(category.sellThroughRate || 0).toFixed(1)}% Overall`}
                        />
                      </div>
                    </div>
                  </Card>
                </Col>
              ))}
            </Row>
          </div>
        )}

        {/* Detailed Model Performance Table */}
        <div className="model-performance-section mb-8 print:mb-6">
          <Title level={3} className="section-title !mb-4">Model Performance Summary</Title>
          <Card size="small" className="performance-table-card">
            {/* Screen version - full featured */}
            <div className="print:hidden">
              <Table
                columns={analyticsColumns}
                dataSource={analytics?.modelPerformance || summary}
                rowKey={analytics?.modelPerformance ? 'modelName' : 'modelId'}
                pagination={false}
                size="small"
                className="performance-table"
                scroll={{ x: 800 }}
              />
            </div>
            {/* Print version - compact */}
            <div className="hidden print:block">
              <Table
                columns={printColumns}
                dataSource={analytics?.modelPerformance || summary}
                rowKey={analytics?.modelPerformance ? 'modelName' : 'modelId'}
                pagination={false}
                size="small"
                className="performance-table"
                showHeader={true}
              />
            </div>
          </Card>
        </div>

        {/* Report Footer */}
        <div className="report-footer mt-8 print:mt-6 text-center">
          <Divider />
          <div className="footer-content">
            <Text type="secondary">
              This report was generated automatically by the TMR Trading Lanka Inventory Management System
            </Text>
            <br />
            <Text type="secondary" style={{ fontSize: '12px' }}>
              For inquiries, contact: gunawardhanamotorsembilipitiya@gmail.com | +94 77 8318 061
            </Text>
            <br />
            <Text type="secondary" style={{ fontSize: '11px' }}>
              Report ID: INV-{format(reportDate, 'yyyyMMdd-HHmmss')} |
              Generated: {format(reportDate, 'yyyy-MM-dd HH:mm:ss')}
            </Text>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InventoryReport;
