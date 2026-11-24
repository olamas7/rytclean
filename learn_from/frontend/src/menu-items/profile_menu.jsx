import LogoutIcon from '@mui/icons-material/Logout';
import PersonIcon from '@mui/icons-material/Person';

const profileMenuItems = [
  {
    id: 'user-profile',
    title: 'User Profile',
    icon: PersonIcon,
    route: '/user-profile',
  },
  {
    id: 'logout',
    title: 'Logout',
    icon: LogoutIcon,
    onClick: 'handleLogout', // Special handler for logout
  },
];

export default profileMenuItems;
