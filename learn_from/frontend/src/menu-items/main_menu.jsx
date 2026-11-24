// assets
import {
  AddReactionOutlined,
  DashboardOutlined,
  MoneyOutlined,
  SettingsOutlined,
  WorkOutlineRounded,
  ContactSupportOutlined
} from '@mui/icons-material';

// ==============================|| DASHBOARD MENU ITEMS ||============================== //

const main_menus = {
  id: 'main_menus',
  title: '',
  caption: '',
  type: 'group',

  children: [
    {
      id: 'main_dash',
      title: 'Dashboard',
      type: 'item',
      url: '/app',
      icon: DashboardOutlined
    },
    {
      id: 'purchase_plan',
      title: 'Buy Wifi Plan',
      type: 'item',
      url: '/purchase',
      icon: MoneyOutlined
    },
    {
      id: 'contact_us',
      title: 'Contact Us',
      type: 'item',
      url: '/contact-us',
      icon: ContactSupportOutlined
    },
    {
      id: 'add_friend',
      title: 'Add a Friend',
      type: 'item',
      url: '/add-friend',
      icon: AddReactionOutlined
    },
    {
      id: 'kay_agent',
      title: 'Agents',
      type: 'item',
      url: '/agents',
      icon: WorkOutlineRounded,
      permissionId: 12
    },
    {
      id: 'hostel_owners',
      title: 'Hostel Owners',
      type: 'item',
      url: '/hostel-owners',
      icon: SettingsOutlined,
      permissionId: [13, 14]
    },
    {
      id: 'over_admin',
      title: 'Super Admin',
      type: 'item',
      url: '/super_admins',
      icon: SettingsOutlined,
      permissionId: 13
    }
  ]
};

export default main_menus;
