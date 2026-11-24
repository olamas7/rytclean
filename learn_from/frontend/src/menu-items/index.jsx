import { filterMainMenu, filterAdmin } from './filteredMenus';

// ==============================|| MENU ITEMS ||============================== //

const getMenuItems = (normalizedPermissions) => ({
    items: [filterMainMenu(normalizedPermissions)]
});

export default getMenuItems;
