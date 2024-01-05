import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Badge } from "./ui/badge";

export function RecentSales() {
  return (
    <div className="space-y-8 overflow-auto">
      <div className="flex justify-between">
        <div className="flex">
          <Avatar className="h-9 w-9">
            <AvatarImage src="/avatars/01.png" alt="Avatar" />
            <AvatarFallback>OM</AvatarFallback>
          </Avatar>

          <div className="ml-4 space-y-1">
            <p className="text-sm font-medium leading-none">Olivia Martin</p>
            <p className="text-sm text-muted-foreground">
              olivia.martin@email.com
            </p>
          </div>
        </div>
        <Badge
          variant={"outline"}
          style={{ backgroundColor: "red", fontSize: "20px" }}
        >
          🍔
        </Badge>
        <div className=" font-medium">+$1,999.00</div>
      </div>
      <div className="flex justify-between">
        <div className="flex">
          <Avatar className="h-9 w-9">
            <AvatarImage src="/avatars/01.png" alt="Avatar" />
            <AvatarFallback>OM</AvatarFallback>
          </Avatar>

          <div className="ml-4 space-y-1">
            <p className="text-sm font-medium leading-none">Olivia Martin</p>
            <p className="text-sm text-muted-foreground">
              olivia.martin@email.com
            </p>
          </div>
        </div>
        <Badge
          variant={"outline"}
          style={{ backgroundColor: "violet", fontSize: "20px" }}
        >
          🏋🏼‍♀️
        </Badge>
        <div className=" font-medium">+$1,999.00</div>
      </div>
      <div className="flex justify-between">
        <div className="flex">
          <Avatar className="h-9 w-9">
            <AvatarImage src="/avatars/01.png" alt="Avatar" />
            <AvatarFallback>OM</AvatarFallback>
          </Avatar>

          <div className="ml-4 space-y-1">
            <p className="text-sm font-medium leading-none">Olivia Martin</p>
            <p className="text-sm text-muted-foreground">
              olivia.martin@email.com
            </p>
          </div>
        </div>
        <Badge
          variant={"outline"}
          style={{ backgroundColor: "gray", fontSize: "20px" }}
        >
          🏠
        </Badge>
        <div className=" font-medium">+$1,999.00</div>
      </div>
      <div className="flex justify-between">
        <div className="flex">
          <Avatar className="h-9 w-9">
            <AvatarImage src="/avatars/01.png" alt="Avatar" />
            <AvatarFallback>OM</AvatarFallback>
          </Avatar>

          <div className="ml-4 space-y-1">
            <p className="text-sm font-medium leading-none">Olivia Martin</p>
            <p className="text-sm text-muted-foreground">
              olivia.martin@email.com
            </p>
          </div>
        </div>
        <Badge
          variant={"outline"}
          style={{ backgroundColor: "red", fontSize: "20px" }}
        >
          🍔
        </Badge>
        <div className=" font-medium">+$1,999.00</div>
      </div>
      <div className="flex justify-between">
        <div className="flex">
          <Avatar className="h-9 w-9">
            <AvatarImage src="/avatars/01.png" alt="Avatar" />
            <AvatarFallback>OM</AvatarFallback>
          </Avatar>

          <div className="ml-4 space-y-1">
            <p className="text-sm font-medium leading-none">Olivia Martin</p>
            <p className="text-sm text-muted-foreground">
              olivia.martin@email.com
            </p>
          </div>
        </div>
        <Badge
          variant={"outline"}
          style={{ backgroundColor: "red", fontSize: "20px" }}
        >
          🍔
        </Badge>
        <div className=" font-medium">+$1,999.00</div>
      </div>
    </div>
  );
}
