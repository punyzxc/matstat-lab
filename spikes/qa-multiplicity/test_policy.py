"""Independent verification of the discovery budget calculator; no product imports."""
from decimal import Decimal, localcontext
from fractions import Fraction
import math
import unittest

from policy import binomial_probabilities, acceptance_band, concentration_band, report


class PolicyChecks(unittest.TestCase):
    def test_inventory_counts_assertions_not_test_blocks(self):
        data = report()
        self.assertEqual(data["inventory"]["oracleMetrics"], 3*3*2)
        self.assertEqual(data["inventory"]["nominalComparisons"], 18+5+4)
        self.assertEqual(data["inventory"]["illustrativeUndercoverage"], 1)

    def test_pmf_agrees_with_exact_rational_small_case(self):
        p = Fraction(19, 20)
        got = binomial_probabilities(8)
        with localcontext() as context:
            context.prec = 70
            for k, value in enumerate(got):
                exact = math.comb(8, k)*p**k*(1-p)**(8-k)
                expected = Decimal(exact.numerator)/Decimal(exact.denominator)
                self.assertLess(abs(value-expected), Decimal('1e-65'))
            self.assertLess(abs(sum(got)-1), Decimal('1e-65'))

    def test_existing_published_band_anchor(self):
        band = acceptance_band(2000, Decimal('0.001'))
        self.assertEqual([band["lo"], band["hi"]], [1867, 1931])

    def test_bands_have_correct_tail_inequalities_and_maximal_exclusion(self):
        for row in report()["coverageBands"]:
            tail = Decimal(row["alpha"])/2
            self.assertLessEqual(Decimal(row["lowerTail"]), tail)
            self.assertLessEqual(Decimal(row["upperTail"]), tail)
            self.assertGreater(Decimal(row["lowerTail"])+Decimal(row["lowerBoundaryMass"]), tail)
            self.assertGreater(Decimal(row["upperTail"])+Decimal(row["upperBoundaryMass"]), tail)

    def test_smaller_alpha_never_narrows_a_band(self):
        for n in [2000, 20000]:
            baseline = acceptance_band(n, Decimal('0.001'))
            corrected = acceptance_band(n, Decimal(1)/18000)
            self.assertLessEqual(corrected["lo"], baseline["lo"])
            self.assertGreaterEqual(corrected["hi"], baseline["hi"])

    def test_allocation_covers_both_scheduled_runs(self):
        data = report()
        self.assertEqual(len(data["mandatoryCases"]), 9)
        with localcontext() as context:
            context.prec = 70
            per_check = Decimal(1)/18000
            self.assertAlmostEqual(per_check*9*2, Decimal('0.001'), places=60)
        self.assertEqual(len({case["id"] for case in data["mandatoryCases"]}), 9)
        self.assertTrue(all(isinstance(case["seed"], int) for case in data["mandatoryCases"]))

    def test_concentration_endpoints_meet_predeclared_tail_budget(self):
        alpha = 1/18000
        for total in [64000, 640000]:
            uniform = concentration_band("uniform", total, alpha)
            self.assertLessEqual(2*math.exp(-2*total*(uniform["upper"]-.5)**2), alpha*(1+1e-10))
            exponential = concentration_band("exponential", total, alpha)
            upper_delta = exponential["upper"]-1
            lower_delta = 1-exponential["lower"]
            self.assertLessEqual(math.exp(-total*(upper_delta-math.log1p(upper_delta))), alpha/2*(1+1e-10))
            self.assertLessEqual(math.exp(-total*(-lower_delta-math.log1p(-lower_delta))), alpha/2*(1+1e-10))
            self.assertGreater(exponential["upper"]-1, 1-exponential["lower"])

    def test_bad_inputs_are_rejected(self):
        for n, alpha in [(0, .001), (1.5, .001), (10, 0), (10, 1)]:
            with self.assertRaises(ValueError):
                acceptance_band(n, Decimal(str(alpha)))


if __name__ == '__main__':
    unittest.main()
