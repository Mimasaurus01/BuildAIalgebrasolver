import json
import sys

from sympy import Eq, factor, latex, solve, simplify, symbols
from sympy.parsing.sympy_parser import (
    convert_xor,
    implicit_multiplication_application,
    parse_expr,
    standard_transformations,
)

try:
    from sympy.parsing.latex import parse_latex
except Exception:
    parse_latex = None


TRANSFORMATIONS = standard_transformations + (
    convert_xor,
    implicit_multiplication_application,
)


def parse_expression(value: str):
    cleaned = value.strip().replace("−", "-").replace("×", "*").replace("÷", "/")
    if parse_latex and ("\\" in cleaned or "{" in cleaned):
        try:
            return parse_latex(cleaned)
        except Exception:
            pass
    return parse_expr(cleaned, transformations=TRANSFORMATIONS, evaluate=True)


def parse_equation(value: str):
    if "=" in value:
        left, right = value.split("=", 1)
        return Eq(parse_expression(left), parse_expression(right))
    return parse_expression(value)


def text_expression(value) -> str:
    return str(simplify(value))


def solve_input(payload):
    raw_text = payload["rawText"]
    latex_input = payload["latex"]
    equation = parse_equation(latex_input)
    variables = sorted(equation.free_symbols, key=lambda item: str(item))
    if not variables:
        raise ValueError("No variable found. Include a variable such as x.")

    variable = variables[0]
    solutions = solve(equation, variable)
    if not solutions:
        solution_text = "No solution"
    else:
        solution_text = ", ".join(text_expression(item) for item in solutions)

    if isinstance(equation, Eq):
        left = simplify(equation.lhs)
        right = simplify(equation.rhs)
        difference = simplify(left - right)
        steps = [
            {
                "label": "Start",
                "expression": f"{text_expression(left)} = {text_expression(right)}",
                "detail": "Begin with the equation recognized from your input.",
            }
        ]

        if difference.has(variable) and difference.as_poly(variable) is not None:
            polynomial = difference.as_poly(variable)
            degree = polynomial.degree()
            if degree == 1:
                coefficient = polynomial.coeff_monomial(variable)
                constant = polynomial.coeff_monomial(1)
                isolated = simplify(-constant)
                steps.append(
                    {
                        "label": "Collect terms",
                        "expression": f"{text_expression(coefficient * variable)} = {text_expression(isolated)}",
                        "detail": f"Move the constant term to the other side and keep {variable} terms together.",
                    }
                )
                steps.append(
                    {
                        "label": "Divide by the coefficient",
                        "expression": f"{variable} = {solution_text}",
                        "detail": f"Divide both sides by {text_expression(coefficient)}.",
                    }
                )
            elif degree and degree > 1:
                steps.append(
                    {
                        "label": "Simplify",
                        "expression": f"{text_expression(difference)} = 0",
                        "detail": "Move everything to one side of the equation.",
                    }
                )
                steps.append(
                    {
                        "label": "Factor",
                        "expression": f"{text_expression(factor(difference))} = 0",
                        "detail": "Factor the polynomial to reveal the possible roots.",
                    }
                )

        steps.append(
            {
                "label": "Answer",
                "expression": f"{variable} = {solution_text}",
                "detail": "Substitute the solution back into the original equation to check it.",
            }
        )
    else:
        steps = [
            {
                "label": "Expression",
                "expression": text_expression(equation),
                "detail": "This expression was parsed successfully.",
            },
            {
                "label": "Answer",
                "expression": f"{variable} = {solution_text}",
                "detail": "These are the values that satisfy the expression.",
            },
        ]

    return {
        "mode": payload["mode"],
        "rawText": raw_text,
        "latex": latex(latex_input) if False else latex_input,
        "equation": str(equation),
        "variable": str(variable),
        "solution": solution_text,
        "steps": steps,
    }


if __name__ == "__main__":
    try:
        payload = json.loads(sys.stdin.read())
        print(json.dumps(solve_input(payload)))
    except Exception as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)