import React from 'react';
import { Tabs, Card } from 'antd';
import { UserOutlined, LockOutlined, SettingOutlined, HistoryOutlined, SafetyCertificateOutlined, SkinOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';
import VerificationBadge from '../../components/VerificationBadge';
import UserProfile from '../../components/user/UserProfile';
import PasswordChange from '../../components/user/PasswordChange';
import UserPreferences from '../../components/user/UserPreferences';
import UserActivity from '../../components/user/UserActivity';
import BrandingSettings from '../../components/user/BrandingSettings';

const { TabPane } = Tabs;

const ProfilePage = () => {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 py-8">
      <div className="container mx-auto px-4">
        <div className="max-w-6xl mx-auto">
          <Card className="shadow-sm">
            <Tabs defaultActiveKey="profile" size="large" className="user-profile-tabs">
              <TabPane
                tab={
                  <span>
                    <UserOutlined />
                    Profile
                  </span>
                }
                key="profile"
              >
                <UserProfile />
              </TabPane>
              
              <TabPane
                tab={
                  <span>
                    <LockOutlined />
                    Security
                  </span>
                }
                key="security"
              >
                <PasswordChange />
              </TabPane>

              <TabPane
                tab={
                  <span>
                    <SafetyCertificateOutlined />
                    Verification
                  </span>
                }
                key="verification"
              >
                <div className="space-y-6">
                  <Card className="shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Email Verification Status</h3>
                        <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">Your account may require email verification to access all features.</p>
                      </div>
                      <div className="shrink-0"><VerificationBadge hideWhenDisabled={false} /></div>
                    </div>
                  </Card>
                  <Card className="shadow-sm">
                    <div className="sm:flex sm:items-center sm:justify-between">
                      <div>
                        <h4 className="text-base font-medium text-gray-800 dark:text-gray-100">Verify your email</h4>
                        <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">Click the button below to go to the verification page and complete your email verification.</p>
                      </div>
                      <div className="mt-4 sm:mt-0">
                        <Link
                          to="/verify"
                          className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                          Go to Verify
                        </Link>
                      </div>
                    </div>
                  </Card>
                </div>
            </TabPane>

            <TabPane
              tab={
                <span>
                  <SkinOutlined />
                  Branding
                </span>
              }
              key="branding"
            >
              <BrandingSettings />
            </TabPane>

            <TabPane
              tab={
                <span>
                  <SettingOutlined />
                  Preferences
                  </span>
                }
                key="preferences"
              >
                <UserPreferences />
              </TabPane>
              
              <TabPane
                tab={
                  <span>
                    <HistoryOutlined />
                    Activity
                  </span>
                }
                key="activity"
              >
                <UserActivity />
              </TabPane>
            </Tabs>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
