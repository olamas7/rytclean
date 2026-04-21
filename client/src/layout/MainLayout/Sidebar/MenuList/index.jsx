import NavGroup from './NavGroup';
import menuItem from 'menu-items';

const MenuList = () => {
  const navItems = menuItem.items.map((item) => <NavGroup key={item.id} item={item} />);

  return <>{navItems}</>;
};

export default MenuList;
