import secrets
import string


SYMBOLS = "!@#$%^&*()-_=+[]{};:,.?"


def validate_password_policy(password: str) -> list[str]:
    errors: list[str] = []
    if len(password) < 8:
        errors.append("La contraseña debe tener al menos 8 caracteres.")
    if not any(character.isupper() for character in password):
        errors.append("La contraseña debe incluir una letra mayúscula.")
    if not any(character.islower() for character in password):
        errors.append("La contraseña debe incluir una letra minúscula.")
    if not any(character.isdigit() for character in password):
        errors.append("La contraseña debe incluir un número.")
    if not any(character in SYMBOLS for character in password):
        errors.append("La contraseña debe incluir un símbolo.")
    return errors


def generate_temporary_password(length: int = 14) -> str:
    if length < 8:
        length = 8
    required_characters = [
        secrets.choice(string.ascii_uppercase),
        secrets.choice(string.ascii_lowercase),
        secrets.choice(string.digits),
        secrets.choice(SYMBOLS),
    ]
    alphabet = string.ascii_letters + string.digits + SYMBOLS
    remaining = [secrets.choice(alphabet) for _ in range(length - len(required_characters))]
    password_characters = required_characters + remaining
    secrets.SystemRandom().shuffle(password_characters)
    return "".join(password_characters)
