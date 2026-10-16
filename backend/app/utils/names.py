def normalize_name(value: str) -> str:
    return " ".join(value.split()).casefold()


def next_sale_name(occupied_names: list[str]) -> str:
    occupied = {normalize_name(name) for name in occupied_names}
    number = 1
    while f"venta {number}" in occupied:
        number += 1
    return f"Venta {number}"
