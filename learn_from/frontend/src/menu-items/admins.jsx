// assets
import {
  AddBusinessOutlined,
  BookOutlined,
  MonetizationOnOutlined,
  PeopleAltOutlined,
  ReportOutlined,
  SettingsOutlined,
  StorageOutlined,
  MessageOutlined
} from '@mui/icons-material';

// ==============================|| DASHBOARD MENU ITEMS ||============================== //

const administrator = {
  id: 'adminz',
  title: '',
  caption: '',
  type: 'group',
  children: [
    {
      id: 'useracct',
      title: 'User Accounts',
      type: 'item',
      url: '/admins/users',
      icon: PeopleAltOutlined,
      permissionId: 61
    },
    {
      id: 'received_revenue',
      title: 'Received Revenue',
      type: 'item',
      url: '/admins/receive-revenue',
      icon: MonetizationOnOutlined,
      permissionId: 62
    },
    {
      id: 'revenue_report',
      title: 'Revenue Report',
      type: 'item',
      url: '/admins/revenue-report',
      icon: ReportOutlined,
      permissionId: 63
    },
    {
      id: 'admin_subscribers',
      title: 'Subscribers',
      type: 'item',
      url: '/admins/subscribers',
      icon: PeopleAltOutlined,
      permissionId: 64
    },
    {
      id: 'admin_clients',
      title: 'Clients',
      type: 'item',
      url: '/admins/clients',
      icon: PeopleAltOutlined,
      permissionId: 65
    },
    {
      id: 'agent_settings',
      title: 'Agent Settings',
      type: 'item',
      url: '/admins/agent-settings',
      icon: SettingsOutlined,
      permissionId: 66
    },
    {
      id: 'bulk_sms',
      title: 'Bulk SMS',
      type: 'item',
      url: '/admins/bulk-sms',
      icon: MessageOutlined,
      permissionId: 66
    }
  ]
};

export default administrator;
