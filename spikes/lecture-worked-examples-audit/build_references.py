"""Build reviewable reference fixtures from explicit source inputs, never lecture tables."""
from pathlib import Path
from fractions import Fraction as F
from itertools import product
from math import asin, ceil, comb, erf, exp, factorial, fsum, log, pi, sqrt
import json
import sys
import audit_math as a

HERE = Path(__file__).parent
SOURCE_SHA = '8dfee73781e39d6946d76c07866f2a0534a3d988'
BASE = f'https://github.com/punyzxc/matstat-lab/blob/{SOURCE_SHA}/lectures/'
values = []


def add(lec, key, title, page, lines, printed, result, verdict='confirmed', phi='none', method='', note='', inputs=None, reusable=True):
    values.append({'id': f'L{lec:02}-{key}', 'lecture': f'L{lec:02}', 'title': title,
      'source': {'pdf': BASE + f'L{lec:02}.pdf', 'page': page, 'lines': lines},
      'lecture_value': printed, 'recomputed': result, 'verdict': verdict, 'phi': phi,
      'method': method, 'note': note, 'inputs': inputs or {}, 'reusable': reusable})


# L1: every evaluated count/probability; symbolic combinatorics is covered by its erratum.
add(1, 'three-digit', 'Three-digit integers', 13, 'l011-l014', 900, sum(1 for _ in range(100, 1000)), method='Enumeration of integers 100..999')
add(1, 'permutations', 'Three-volume arrangements', 13, 'l030-l032', 6, factorial(3), method='3!')
add(1, 'repetition', 'Combinations with repetition pin', 16, 'l001-l011', 'C(n+k-1,k-1)',
    {'n': 3, 'k': 2, 'correct': len({tuple(sorted(x)) for x in product(range(3), repeat=2)}), 'printed_formula': comb(4, 1)},
    'corrected', method='Enumerate unordered multisets for n=3,k=2', note='Derived diagnostic input; source is a symbolic formula, not a printed numerical example.')
counts = a.empty_boxes(5)
add(1, 'empty-boxes', 'Five balls in five boxes: 0..4 empty boxes', 25, 'l022-l050', ['24/625', '48/125', '12/25', '12/125', '1/625'],
    {'counts': counts, 'denominator': 5**5, 'probabilities': [float(F(c, 5**5)) for c in counts[:5]]}, method='Enumerate all 5^5 labeled assignments')
for lec, page in [(1, 27), (4, 2)]:
    add(lec, 'sine-square', 'Existence of sqrt(1/2-sin^2(x))', page, 'l010-l014', .5, 2*asin(sqrt(.5))/pi,
        method='Length of four arcs in [0,2*pi); sin is squared, verified in PDF')
    add(lec, 'bertrand', 'Bertrand: sampling scheme matters', page+1, 'l001-l029', {'radius': '1/2', 'endpoints': '1/3', 'claimed_unique': .5},
        {'uniform_radius_midpoint': .5, 'uniform_endpoints': 1/3, 'uniform_disc_midpoint': .25}, 'ambiguous',
        method='Radius fractions; central angle fraction; disc area ratio', note='Third scheme is an independently supplied diagnostic. No unique unqualified answer.', reusable=False)
add(1, 'observed-frequency', '450 heads in 1000 tosses', 29, 'l009-l016', {'frequency': .45, 'deviation_percent': 5},
    {'frequency': 450/1000, 'absolute_deviation': abs(450/1000-.5), 'percentage_points': 5}, method='Exact count ratio; 5 percentage points, not relative 5 percent')
add(1, 'historical-frequencies', 'Buffon and Pearson count ratios', 31, 'l006-l008', {'Buffon_counts': [2048,4040], 'Pearson_counts': [12012,24000]},
    {'Buffon_ratio': 2048/4040, 'Pearson_ratio': 12012/24000}, method='Arithmetic of reported observations; historical truth not audited')
add(2, 'die-even', 'Fair die: even result', 5, 'l025-l048', '1/2', sum(k % 2 == 0 for k in range(1,7))/6, method='Enumerate six faces')
add(2, 'guessing-student', 'Five-option posterior', 7, 'l001-l019', 'Penultimate (1-p)/(4p+1), final p/(4p+1)',
    {'formula': '(1-p)/(1+4*p)', 'diagnostics': {str(p):float(((1-p)/5)/(p+(1-p)/5)) for p in [F(0),F(1,4),F(1)]}}, 'corrected',
    method='Bayes: guessing-and-correct=(1-p)/5; correct=p+(1-p)/5', note='PDF final equality drops 1-; correct penultimate expression retained. Diagnostic p values are independently supplied.')

# L3: exact binomial sums plus separately named approximations.
b50 = float(a.binomial(5000, '.01', 50, 50))
bcdf = float(a.binomial(5000, '.01', 0, 50))
add(3, 'five-days', 'Five days versus exactly five of seven', 4, 'l002-l008', .311,
    {'written_five_successive_days': float(F(3,4)**5), 'solved_exactly_five_of_seven': float(F(comb(7,5)*3**5,4**7))}, 'ambiguous',
    method='Exact rational powers/binomial coefficient', note='Two different events; do not silently replace the wording.', reusable=False)
add(3, 'binomial-pmf', '5000 trials, p=.01, exactly 50', 4, 'l010-l020', .0572, b50, 'corrected', method='80-digit Decimal binomial recurrence', inputs={'n':5000,'p':'.01','lo':50,'hi':50})
add(3, 'binomial-cdf', '5000 trials, p=.01, at most 50', 4, 'l021-l031', .5033, bcdf, 'corrected', method='80-digit Decimal exact-law finite sum', inputs={'n':5000,'p':'.01','lo':0,'hi':50})
add(3, 'binomial-mode', 'Mode of Bin(5000,.01)', 4, 'l036-l040', 51, ((5000+1)*F(1,100)).__floor__(), 'corrected', method='Compare adjacent PMF ratios; floor((n+1)p)=50')
add(3, 'local-normal', 'Local normal approximation to P(X=50)', 6, 'l043-l061', .057,
    {'local_normal': 1/sqrt(2*pi*49.5), 'exact': b50}, 'approximation', method='Normal density at mean / sqrt(npq)')
add(3, 'plain-normal-cdf', 'Uncorrected normal approximation at mean', 8, 'l064-l081', .5,
    {'plain_normal': a.normal_cdf(0)-a.normal_cdf(-50/sqrt(49.5)), 'continuity_corrected': a.normal_cdf(.5/sqrt(49.5))-a.normal_cdf(-50.5/sqrt(49.5)), 'exact': bcdf},
    'approximation', 'normal_cdf', method='erf-based normal CDF, separately compare exact sum')
add(3, 'central-band', 'Rough P(40<=X<=60)', 9, 'l003-l008', '.037*20 ~= .7', float(a.binomial(5000,'.01',40,60)),
    'approximation', method='80-digit exact-law finite sum; inclusive count is 21 integers')
add(3, 'typos', 'At least one of 100 typos on a selected page of 1000', 10, 'l057-l076', .0952,
    {'exact': float(1-a.binomial(100,'.001',0,0)), 'poisson': 1-exp(-.1)}, 'approximation',
    method='1-(999/1000)^100 and Poisson approximation', note='Assumes independent uniform page assignment of the 100 typos; the n=100,p=.001 model is consistent with the statement.')
z = a.normal_quantile(.99)
add(3, 'coin-size', 'Coin frequency accuracy .01 at approximate .98 confidence', 12, 'l001-l014', 13225,
    {'z_0_99': z, 'continuous_normal_n': .25*(z/.01)**2, 'rounded_up_normal_n': ceil(.25*(z/.01)**2)}, 'corrected', 'normal_cdf',
    method='Invert standard normal without tables', note='Normal-approximation design only; this is not an exact finite-binomial minimum.')

# L5 has no fixed numerical worked answer, but the ECDF convention is an explicit pin.
add(5, 'indicator-jumps', 'Strict CDF of Bernoulli indicator', 3, 'l020-l035', 'F(x)=P(X<x), left continuous',
    {'diagnostic_p': .3, 'strict_at_0': 0, 'strict_at_1': .7, 'non_strict_at_0': .7, 'non_strict_at_1': 1},
    method='Enumerate atoms 0 and 1; diagnostic p=.3', note='The strict convention itself is valid; label differences at jumps explicitly.')

# L6 evaluated tables and numerical conclusions.
for k, printed, percent in [(1,.6826,32),(2,.9544,5),(3,.9973,.7),(4,.9997,.07)]:
    inside = erf(k/sqrt(2))
    add(6, f'sigma-{k}', f'{k}-sigma central probability and outside percent', 14, 'l004-l008', {'inside':printed, 'outside_percent':percent},
        {'inside':inside, 'outside_percent':100*(1-inside)}, 'corrected' if k>=3 else 'approximation', 'normal_cdf',
        method='erf(k/sqrt(2)); both tails included', note='At 3 sigma the final .9973 is correct rounded; intermediate 1-.00135 and outside .7% are incorrect.')
add(6, 'square-law', 'Square of uniform {-1,0,1}', 15, 'l001-l036', {'P_0':'2/3','P_1':'1/3'},
    {'P_0':sum(x*x==0 for x in [-1,0,1])/3,'P_1':sum(x*x==1 for x in [-1,0,1])/3}, 'corrected',
    method='Enumerate three equally likely atoms; printed probabilities are interchanged')
add(6, 'independent-product', 'Product law needs independent copies', 15, 'l028-l063', ['2/9','5/9','2/9'],
    {str(v):sum(x*y==v for x,y in product([-1,0,1], repeat=2))/9 for v in [-1,0,1]},
    method='Enumerate nine pairs of independent copies', note='xi*xi equals xi^2; the source distinction is false without two independent copies.')
joint = [[F(1,3),F(1,3)],[F(1,6),F(1,6)]]
add(6, 'independence', 'Two-by-two independence table', 24, 'l011-l040', {'joint':[['1/3','1/3'],['1/6','1/6']], 'independent':True},
    {'xi_marginal':[float(sum(row[i] for row in joint)) for i in range(2)], 'eta_marginal':[float(sum(row)) for row in joint],
     'joint_at_half':float(joint[0][0]), 'product_at_half':float(sum(row[0] for row in joint)*sum(joint[0]))}, method='Exact rational row/column sums and products')
add(6, 'bad-matrix', 'Intermediate p25 matrix is not a joint law', 25, 'l001-l050', [['1/2','1/2'],['2/3','1/3']],
    {'printed_matrix_sum':float(F(1,2)+F(1,2)+F(2,3)+F(1,3)), 'valid_joint':[[float(v) for v in row] for row in joint]}, 'corrected',
    method='Rational normalization; valid joint copied from p24, not inferred from bad matrix')
for x, printed in [('0.5','1/8'),('1','1/2'),('1.5','7/8')]:
    add(6, 'two-failures-'+x.replace('.','_'), 'Two uniform lifetimes: P(sum<t)', 33, 'l057-l059', printed, float(a.uniform_sum_cdf(2,x)), method='Exact truncated-power volume formula', inputs={'n':2,'t':x})
for n,page,lines in [(2,29,'l001-l028'),(3,30,'l012-l072'),(4,32,'l001-l046')]:
    grid=[F(j,2) for j in range(2*n+1)]
    add(6,f'uniform-density-{n}',f'Piecewise density of sum of {n} uniforms',page,lines,
        'Piecewise polynomial density; no fixed-point numeric table' if n!=4 else
          {'on_1_to_2':'x-1-(x-3)^3/3+(2-x)^3/6','on_2_to_3':'3-x+(x-2)^3/6-(3-x)^3/6'},
        {'x':[float(x) for x in grid],'density':[float(a.uniform_sum_density(n,x)) for x in grid],
         **({'printed_at_1_5':float(F(3,2)-1-(F(3,2)-3)**3/3+(2-F(3,2))**3/6),
             'printed_at_2_5':float(3-F(5,2)+(F(5,2)-2)**3/6-(3-F(5,2))**3/6),
             'correct_on_1_to_2':'x-1-(x-1)^3/3+(2-x)^3/6',
             'correct_on_2_to_3':'3-x+(x-2)^3/6-(3-x)^3/3'} if n==4 else {})},
        'corrected' if n==4 else 'confirmed',
        method='Differentiate exact simplex-volume inclusion/exclusion formula',
        note='Diagnostic half-integer grid is independently supplied, not printed as a numeric table. For n=4, source middle polynomials are wrong (PDF p32); corrected branches follow exact volume differentiation.',inputs={'n':n})
add(6, 'sum-cdf-outside', 'Uniform-sum CDF above its support', 33, 'l030-l048', '0 outside [0,2]',
    {'at_minus_1':float(a.uniform_sum_cdf(2,-1)), 'at_3':float(a.uniform_sum_cdf(2,3))}, 'corrected', method='CDF must be 1 above upper support; source piecewise case is wrong')
add(6, 'lottery', 'Lottery fixed-point mean and variance', 37, 'l001-l024', 'M=D=1, independent of player count; M+sqrt(D)=2',
    [a.lottery(n) for n in range(1,8)], 'corrected', method='Enumerate every permutation for n=1..7', note='Mean=1 always; variance=1 only for n>=2. For n=1 variance=0. Two prizes is not a guaranteed-sufficiency statement.')
add(6, 'disc', 'Uniform disc: covariance zero, dependent', 37, 'l025-l072', {'covariance':0,'marginal_density':'2/(pi*R)'},
    {'covariance':0, 'marginal_density':'2*sqrt(R^2-x^2)/(pi*R^2), |x|<R'}, 'corrected', method='Integrate vertical chord length; xy integral zero by symmetry', note='Independence conclusion (dependent) is correct; source marginal is incorrectly constant.')

add(7, 'chebyshev', 'Universal three-sigma bound', 3, 'l005-l018', '1/9', 1/9, method='variance/(3*sigma)^2')
add(7, 'normal-tail', 'Two-sided standard normal three-sigma tail', 3, 'l019-l021', '<=.00135', 2*a.normal_cdf(-3), 'corrected', 'normal_cdf', method='Sum equal lower and upper tails')
add(7, 'poisson-bound', 'Poisson Chebyshev statement', 3, 'l022-l033', '<=1/9',
    {'universal_bound':1/9, 'diagnostic_lambda_1_tail':a.poisson_tail(1,4)}, method='Source inequality visually confirmed; independent illustrative lambda=1 chosen separately',
    note='Source does not specify lambda and says <=, not >=. Module-map pin is disputed; .019 is not the tail for every Poisson law.')
add(8, 'poisson-limit', 'Poisson sum limit and endpoint diagnostics', 5, 'l030-l044', 'limit 1/2',
    {'asymptotic_limit':.5, 'finite_n_10_strict':exp(-10)*fsum(10**j/factorial(j) for j in range(10)),
     'finite_n_10_inclusive':exp(-10)*fsum(10**j/factorial(j) for j in range(11))}, 'confirmed', 'normal_cdf',
    method='CLT: standardized Poisson(n) tends to N(0,1); direct finite sums distinguish strict and inclusive endpoints', note='The source limit is correct. The finite-n strict/inclusive diagnostics are independently supplied; strict events sum through n-1. No fixed numerical worked answer in L8; never use .5 as exact finite-n probability.')

# L9 bounds are bounds, not estimates of actual event probabilities.
for key, title, page, lines, printed, result, method in [
 ('frequency-bound','Bernoulli frequency, n=10000 p=.3 eps=.01',4,'l001-l020',.79,1-.3*.7/(10000*.01**2),'Chebyshev variance of sample mean'),
 ('good-parts-size','Good-part proportion p=.98 eps=.02 confidence .96',4,'l023-l045',1225,int(F('.98')*F('.02')/(F('.04')*F('.02')**2)),'Exact rational .98*.02/(.04*.02^2); bound only'),
 ('electricity','Mean3000 variance2500 within500',5,'l007-l027',.99,1-2500/500**2,'Chebyshev'),
 ('average','2500 independent variables, sd<=3, eps=.3',6,'l001-l045',.96,1-9/(2500*.3**2),'Chebyshev variance of average'),
 ('length-size','sd<=.04, eps=.001, confidence>.9',6,'l049-l060','n>16000',{'continuous_threshold':int(F('.04')**2/(F('.1')*F('.001')**2)),'minimum_integer':int(F('.04')**2/(F('.1')*F('.001')**2))+1},'Chebyshev strict inequality; exact rational arithmetic'),
]:
    add(9,key,title,page,lines,printed,result,method=method)
for key,n,p,lo,hi,printed,page,lines,phi in [
 ('defects',50,'.2',6,50,.92135,7,'l005-l030','erf'),
 ('first-grade',200,'.6',120,150,.5,7,'l031-l042','erf'),
 ('guarantee',15000,'.04',570,630,.7888,8,'l001-l011','mixed'),
]:
    sd = sqrt(n*float(p)*(1-float(p)))
    exact = float(a.binomial(n,p,lo,hi))
    add(9,key,'Binomial worked probability '+key,page,lines,printed,
        {'exact':exact,'plain_normal':a.normal_cdf((hi-n*float(p))/sd)-a.normal_cdf((lo-n*float(p))/sd),
         'continuity_corrected':a.normal_cdf((hi+.5-n*float(p))/sd)-a.normal_cdf((lo-.5-n*float(p))/sd)},
        'approximation',phi,method='80-digit finite binomial sum, plus independently named normal approximations',inputs={'n':n,'p':p,'lo':lo,'hi':hi},
        note='L9 uses erf-scaled arguments in its interval expressions; the last example also switches to the zero-origin normal integral.')

# L10: audit invalid data rather than fabricate a valid goodness-of-fit p-value.
add(10,'linear-program','Linear program introduction',2,'l015-l039',{'y1':1,'y2':.5},a.lp_vertices(),method='Enumerate all feasible exact-rational boundary intersections')
add(10,'rain-ratios','Monthly rainy-day ratios',2,'l040-l053',['8/31','13/30','21/61'],
    {'august':8/31,'september':13/30,'pooled':21/61},method='Count ratios',note='Whether pooling estimates the desired target depends on sampling weights and target; heterogeneous months do not by themselves make the pooled-day ratio arithmetically invalid.')
add(10,'ecdf-jumps','ECDF count <=x versus left-continuity claim',7,'l006-l052','count <=x; left-continuous',
    {'diagnostic_sample':[1,1,2], 'at_1_strict':0,'at_1_non_strict':2/3,'non_strict_continuity':'right'},'corrected',method='Count atoms on a diagnostic tied sample')
times = list(range(5,81,5))
emp = [.135,.26,.36,.45,.518,.57,.628,.648,.735,.78,.72,.83,.85,.875,.892,.91]
theory = [1-exp(-.03*t) for t in times]
diff = [abs(x-y) for x,y in zip(emp,theory)]
add(10,'exponential-table','F(t)=1-exp(-.03t), table12',9,'l001-l025',
    [139,259,362,451,528,593,650,700,741,777,808,835,858,878,895,909],
    {'times':times,'cdf':theory,'rounded_1000_cdf':[round(1000*v) for v in theory]},'corrected',method='Direct exponential evaluation',note='Source header 10^-3 F is also scaled backwards; intended numbers are 1000 F. Some entries differ from correct rounding.')
add(10,'kolmogorov-data','Kolmogorov example with invalid empirical CDF',10,'l001-l008',{'D':.088,'z':.352,'p_value':.999},
    {'grid_max_absolute_difference':max(diff),'at_time':times[diff.index(max(diff))], 'sqrt_16_times_grid_max':4*max(diff),
     'decreases':[times[i] for i in range(1,len(emp)) if emp[i]<emp[i-1]], 'compatible_with_n16_empirical_steps':all(abs(v*16-round(v*16))<1e-12 for v in emp)},
    'ambiguous',method='Recompute every grid difference; validate monotonicity and step multiples',note='Grid maximum is not a valid continuous sup statistic; table is not an ECDF of 16 raw observations. No valid KS p-value or accept decision can be recovered.',reusable=False)
w = list(map(F,['.135','.125','.100','.090','.068','.082','.048','.052','.040','.040','.030','.020','.020','.025','.017','.018']))
mid = [F(5,2)+5*i for i in range(16)]
contrib = [.0174,.00536,.0012,.0024,.0034,.00067,.019,.001,.0051,.0024,.00022,.0017,.0014,.00071,.00125]
add(10,'pearson-data','Pearson tables and invalid frequency input',12,'l001-l032',{'mean':23.3,'sum_contributions':.0829,'chi_square':1.326},
    {'sum_printed_weights':float(sum(w)), 'weighted_midpoint_sum':float(sum(x*y for x,y in zip(w,mid))),
     'sum_printed_contributions':fsum(contrib), '16_times_printed_contributions':16*fsum(contrib),'16_times_0829':16*.0829,
     'diagnostic_max_expected_count_for_width5_bins_given_mean_23_3':16*(1-exp(-5/23.3)),
     'weights_times_16_all_integer':all((v*16).denominator==1 for v in w)}, 'ambiguous',method='Exact weight/midpoint sums; separately add the 15 printed contributions',
    note='Weights sum below 1, tail omitted, one theory column missing, theory entries resemble CDFs instead of bin masses. Do not silently normalize or invent the missing observations.',reusable=False)
add(10,'pearson-df','Worked exponential df and 95% critical value',13,'l001-l016',{'df':14,'critical':23.7},
    {'df':16-1-1,'critical':a.chi_quantile(.95,14)}, 'approximation', method='k-1-r, k=16 r=1; invert integer gamma CDF',note='The source already gives df14. The module-map pin incorrectly presents L10 as omitting parameter fitting.')

sample = ['3.1','3.3','2.9','3.0','3.1','3.2','2.8','2.7','3.1','3.2','2.9','3.0','2.9','3.1','2.8','2.9','3.2','3.3','2.9','3.1','3.2','3.0']
s = a.sample_stats(sample)
mean, variance = s['mean'], s['variance_n_minus_1']
add(11,'sample22','22 listed measurements',5,'l019-l038',{'mean':3.0318,'variance_n_minus_1':.0303},s,'corrected',method='Exact rational sums before conversion',inputs={'sample':sample})
z975 = a.normal_quantile(.975)
se = sqrt(variance/22)
add(11,'approximate-mean','Approximate mean interval from listed observations',6,'l001-l016',[2.9593,3.1043],
    {'z':z975,'se':se,'interval':[mean-z975*se,mean+z975*se]},'corrected','normal_cdf',method='Rational sample variance then normal quantile')
sev = sqrt(2/21)*variance
add(11,'approximate-variance','Approximate variance interval from listed observations',6,'l001-l016',[.0119,.0487],
    {'se_variance':sev,'interval':[variance-z975*sev,variance+z975*sev]},'corrected','normal_cdf',method='Normal approximation s^2 +/- z*s^2*sqrt(2/(n-1)); model conditional')
t975 = a.student_quantile(.975,21)
qlo,qhi = a.chi_quantile(.025,21),a.chi_quantile(.975,21)
add(11,'student-data','Student interval from listed observations',10,'l013-l029',[2.9528,3.1108],
    {'t_975_21':t975,'interval':[mean-t975*se,mean+t975*se]},'corrected',method='Integrate Student density and invert; standard error s/sqrt(22)')
add(11,'chi-data','Variance interval from listed observations',10,'l030-l037',[.017,.064],
    {'chi2_025_21':qlo,'chi2_975_21':qhi,'interval':[21*variance/qhi,21*variance/qlo]},'corrected',method='Half-integer gamma recurrence and bisection; divide sum of squares by reversed quantiles')
add(11,'student-given','Student interval if p10 stated s^2=.0303 is taken as separate input',10,'l013-l029',[2.9528,3.1108],
    {'interval':[3.0318-t975*sqrt(.0303/22),3.0318+t975*sqrt(.0303/22)],'printed_uses_sqrt_00303_over_21':True},'corrected',
    method='Use exactly the p10 given summary, not the earlier sample; correct denominator is n=22',note='Separates wrong variance/data from the additional n versus n-1 standard-error substitution.')
add(11,'chi-given','Variance interval if p10 stated s^2=.0303 is separate input',10,'l030-l037',[.017,.064],
    [21*.0303/qhi,21*.0303/qlo],'corrected',method='Use given variance but independently recompute df21 quantiles')
add(11,'normal-tail-196','Each normal tail beyond +/-1.96',12,'l023-l025',.025, a.normal_cdf(-1.96),'approximation','normal_cdf',method='erf-based lower normal tail')
add(11,'homogeneity','Two coin samples, n=1000 inferred from denominator',14,'l001-l015',-.447,
    {'pooled':.485,'z':(.48-.49)/sqrt(.485*.515*(1/1000+1/1000))},'approximation',method='Pooled two-proportion z statistic',
    note='Prose leaves n symbolic; the displayed .001+.001 reciprocals imply n1=n2=1000.')
add(11,'coin-null','First coin sample versus p0=.5',14,'l016-l021',-1.26,
    {'correct_z':(.48-.5)/sqrt(.5*.5/1000),'printed_numerator_z':(.48-.49)/sqrt(.5*.5/1000)},'corrected',method='Compute both the printed numerator and the intended p-hat minus p0')
add(12,'proportion-test','Right-tailed proportion test',4,'l013-l025',{'U':.471,'critical':2.33,'Phi0_at_critical':.49,'decision':'accept'},
    {'U':(.12-.1)/sqrt(.1*.9/50),'normal_critical':a.normal_quantile(.99),'Phi0_at_critical':a.phi_zero(a.normal_quantile(.99)),
     'decision':'do not reject at alpha .01','exact_binomial_upper_p':float(a.binomial(50,'.1',6,50))},'approximation','zero_integral',
    method='Direct z statistic; invert normal CDF; optional exact upper-tail diagnostic',note='Normal approximation, not an exact Normal null. Do not interpret non-rejection as probability .99 that H0 is true.')
add(12,'phi-origins','Zero-origin integral versus normal CDF',3,'l033-l046',{'Phi0_at_0':0,'normal_CDF_at_0':.5},
    {'Phi0_at_0':a.phi_zero(0),'normal_CDF_at_0':a.normal_cdf(0)},phi='mixed',method='Symmetry and erf(0)=0')

# Cross-page inputs/definitions, in addition to the primary printed-output anchor.
supplements = {
 'L01-empty-boxes':[(22,'l055-l062')],
 'L01-sine-square':[(26,'l026-l038')], 'L04-sine-square':[(1,'l026-l038')],
 'L01-bertrand':[(27,'l015-l038')], 'L04-bertrand':[(2,'l015-l038')],
 'L02-die-even':[(5,'l049-l055'),(6,'l001-l008')],
 'L03-coin-size':[(11,'l036-l038')], 'L03-local-normal':[(4,'l010-l020')],
 'L03-plain-normal-cdf':[(4,'l010-l031')],
 'L06-uniform-density-2':[(30,'l003-l011')], 'L06-uniform-density-4':[(31,'l037-l060')],
 'L09-guarantee':[(7,'l043-l049')],
 'L10-kolmogorov-data':[(9,'l001-l025')],
 'L10-pearson-data':[(11,'l035-l045'),(13,'l001-l016')], 'L10-pearson-df':[(11,'l019-l038')],
 'L11-approximate-mean':[(5,'l019-l038')], 'L11-approximate-variance':[(5,'l019-l038')],
 'L11-student-data':[(5,'l019-l038')], 'L11-chi-data':[(5,'l019-l038')],
 'L12-proportion-test':[(3,'l033-l046')],
}
for row in values:
    if row['id'] in supplements:
        row['source']['related']=[{'page':p,'lines':lines} for p,lines in supplements[row['id']]]

coverage = {
 'L01':'All evaluated counts, occupancy/geometric examples, numerical frequency illustrations. Generic combinatorial derivations and history are separately classified.',
 'L02':'Fair-die numeric result and five-option worked posterior; remaining arguments are symbolic.',
 'L03':'All evaluated examples, both normal reworkings, rough central band, typo approximation and coin size.',
 'L04':'Duplicate geometric worked examples audited with their own page anchors.',
 'L05':'No fixed-parameter evaluated numeric example; six parameterized distribution/CDF examples. Jump convention audited.',
 'L06':'All evaluated tables and numeric conclusions; convolution polynomial families have independent rational grid diagnostics; other parameterized transforms classified separately.',
 'L07':'Three-sigma comparisons audited; Cauchy and LLN examples are symbolic/no numerical answer.',
 'L08':'No finite fixed-parameter numerical worked answer. Bernoulli/Uniform CLT examples symbolic; Poisson limit explicitly distinguished from finite probability.',
 'L09':'All eight evaluated Chebyshev / normal-binomial worked examples.',
 'L10':'LP/rain examples, numerical CDF and Pearson tables; invalid/incomplete data explicitly prevent a valid GOF decision.',
 'L11':'All sample/interval/coin examples plus tail illustration; data-derived and separately given-summary intervals both recorded.',
 'L12':'Only worked numerical test is the proportion test; a=3 and lambda=2 are hypothesis-definition examples without calculated answers.',
}


def document():
    return {'schema':'lecture-reference-audit/v1','source_commit':SOURCE_SHA,
      'provenance':'PDF page numbers are one-based; lNNN lines follow pypdf extraction with extract_sources.py. PDFs remain only on the course-lectures branch.',
      'precision':'Decimal 80-digit finite binomial sums; exact Fraction enumeration for counts/data; binary64 erf, adaptive Simpson Student integration, half-integer gamma recurrence and 90-step bisection for quantiles. Not interval arithmetic.',
      'lecture_coverage':coverage,'values':values}


def main():
    target=HERE/'fixtures'/'references.json'
    output=json.dumps(document(),ensure_ascii=False,indent=2)+'\n'
    if '--check' in sys.argv:
        if target.read_text(encoding='utf-8') != output:
            raise SystemExit('Recorded reference fixture differs; inspect numerical/platform changes.')
        print(f'{len(values)} fixture groups reproduced unchanged')
    else:
        target.parent.mkdir(exist_ok=True)
        target.write_text(output,encoding='utf-8')
        print(f'Wrote {len(values)} fixture groups')


if __name__=='__main__':
    main()
