import administrator from './admins';
import main_menus from './main_menu';

const filterMainMenu = (normalizedPermissions) => ({
  ...main_menus,
  children: main_menus.children.filter((menu) => {
    if (!menu.permissionId) return true;
    if (Array.isArray(menu.permissionId)) {
      return menu.permissionId.some((id) => normalizedPermissions.includes(id));
    }
    return normalizedPermissions.includes(menu.permissionId);
  })
});

const filterAdmin = (normalizedPermissions) => ({
  ...administrator,
  children: administrator.children.filter((menu) => {
    if (!menu.permissionId) return true;
    if (Array.isArray(menu.permissionId)) {
      return menu.permissionId.some((id) => normalizedPermissions.includes(id));
    }
    return normalizedPermissions.includes(menu.permissionId);
  })
});

export { filterMainMenu, filterAdmin };
