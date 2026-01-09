import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/react";
import { ChevronDown } from "lucide-react";
import { config } from "../../utils/config";
import { openAuthorLink } from "../../utils/opener";
import type { Game, Region } from "../../types/cluster";

type NavbarProps = {
  game: Game;
  selectedRegion: Region | null;
  onRegionChange: (regionId: string) => void;
};

export default function Navbar({
  game,
  selectedRegion,
  onRegionChange,
}: NavbarProps) {
  return (
    <div className="navbar">
      <div>
        <div className="flex items-center">
          <div className="logo"></div>
          <div className="game-select flex items-center gap-2">
            <img width={25} height={25} src={game.icon} />
            <h3>{game.name}</h3>
          </div>
          <hr className="vertical" />
          <div className="game-select">
            <Menu>
              <MenuButton className="dropdownButton flex items-center gap-2">
                <img
                  width={22}
                  height={22}
                  src={selectedRegion?.icon ?? game.icon}
                />
                <h3>
                  {selectedRegion?.alias_name ?? selectedRegion?.name ?? ""}{" "}
                </h3>
                <ChevronDown
                  size={20}
                  strokeWidth={1.5}
                  absoluteStrokeWidth
                />
              </MenuButton>
              <MenuItems
                anchor="bottom"
                transition
                className={
                  "dropdown_items origin-top transition duration-200 ease-out data-closed:scale-95 data-closed:opacity-0 flex justify-between items-center space-y-1 rounded-xl"
                }
              >
                {game.clusters.map((region) => (
                  <MenuItem key={region.id}>
                    <div
                      className="dropdownInteractiveItem flex items-center gap-2"
                      onClick={() => onRegionChange(region.id)}
                    >
                      <img
                        width={22}
                        height={22}
                        src={region.icon}
                        className={
                          region.id === selectedRegion?.id
                            ? "rounded-full"
                            : ""
                        }
                      />
                      <span>{region.name}</span>
                    </div>
                  </MenuItem>
                ))}
              </MenuItems>
            </Menu>
          </div>
        </div>
      </div>
      <div>
        <small>
          <span className="cursor-pointer" onClick={() => openAuthorLink()}>
            {config.AUTHOR}@{config.NAME} {config.VERSION}
          </span>
        </small>
      </div>
    </div>
  );
}
