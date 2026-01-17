
import sys
import os
from pyomo.environ import ConcreteModel, Var, Objective, Constraint, SolverFactory

print(f"Python executable: {sys.executable}")
print(f"PATH: {os.environ.get('PATH')}")

def test_cplex():
    model = ConcreteModel()
    model.x = Var(bounds=(0, 5))
    model.y = Var(bounds=(0, 5))
    model.obj = Objective(expr=model.x + model.y, sense=-1) # Maximize x+y
    model.c1 = Constraint(expr=model.x + 2*model.y <= 10)

    print("\nAttempting to create SolverFactory('cplex')...")
    try:
        solver = SolverFactory('cplex')
        print(f"Solver created. Available? {solver.available()}")
        
        if solver.available():
            print("Attempting to solve...")
            results = solver.solve(model, tee=True)
            print("\nSolve complete!")
            print(f"Status: {results.solver.status}")
            print(f"Termination: {results.solver.termination_condition}")
            print(f"x={model.x()}, y={model.y()}")
        else:
            print("Solver is NOT available (executable not found by Pyomo).")
            # Try to find where cplex is
            import shutil
            cplex_path = shutil.which('cplex')
            print(f"shutil.which('cplex') returns: {cplex_path}")
            
    except Exception as e:
        print(f"\nEXCEPTION caught during solver testing:")
        print(e)
        import traceaback
        traceback.print_exc()

if __name__ == "__main__":
    test_cplex()
