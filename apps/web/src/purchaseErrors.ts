export function purchaseErrorMessage(code: string): string {
  const map: Record<string, string> = {
    not_enough_metal: "Недостаточно металла",
    not_enough_minerals: "Недостаточно минералов",
    not_enough_vespene: "Недостаточно веспена",
    unknown_unit: "Неизвестный корабль",
    unknown_defense: "Неизвестная оборона",
    invalid_quantity: "Некорректное количество",
  };
  return map[code] ?? code;
}
