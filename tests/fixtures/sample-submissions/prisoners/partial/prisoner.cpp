#include "prisoner.h"
#include <bits/stdc++.h>
using namespace std;

typedef long long ll;
typedef pair<ll, ll> pi;
typedef vector <int> vi;
typedef vector <pi> vpi;
typedef pair<pi, ll> pii;
typedef set <ll> si;
typedef long double ld;
#define f first
#define s second
#define mp make_pair
#define FOR(i,s,e) for(int i=s;i<=int(e);++i)
#define DEC(i,s,e) for(int i=s;i>=int(e);--i)
#define pb push_back
#define all(x) (x).begin(), (x).end()
#define lbd(x, y) lower_bound(all(x), y)
#define ubd(x, y) upper_bound(all(x), y)
#define aFOR(i,x) for (auto i: x)
#define mem(x,i) memset(x,i,sizeof x)
#define fast ios_base::sync_with_stdio(false),cin.tie(0),cout.tie(0)
#define maxn 200010
#define INF 1e9
#define MOD 998244353
typedef pair <vi, int> pvi;
typedef pair <int,pi> ipi;

int box[maxn];
bool in[maxn];
//~ int cur_id;
int open(int x){
    assert(x != -1);
    int key = openBox(x);
    box[key] = x;

    //~ cout << "OPEN " << cur_id << ' ' << x << '\n';

    return key;
}
bool first_half = 1;
void prisoner(int N, int id) {
    //~ cur_id = id;
    if (N == 1){
        open(id);
        return;
    }
    if (id == 0){
        mem(box,-1);
        int fi = open(0);
        if (fi <= 1){ //both key 0 and key 1 are in first half
            FOR(i,1,N-1) open(i);
        }else{ //both key 0 and key 1 are in second half, key 0 is at 2*N-1
            FOR(i,N+1,2*N-1) open(i);
            first_half = 0;
        }
        //~ cout << "FIRST HALF? " << first_half << '\n';
    }else if (id == 1){
        if (first_half){
            int key1 = box[1];
            open(key1);
            FOR(i,N,2*N-2) open(i);
        }else{
            int key1 = (box[1] == -1 ? N : box[1]);
            open(key1);
            FOR(i,2,N) open(i);
        }
    }else if (id == 2){
        FOR(i,0,2*N-1) if (box[i] == -1){
            FOR(j,0,2*N-1) if (box[j] != -1) in[box[j]] = 1;
            FOR(j,0,2*N-1) if (!in[j]) box[i] = j;
        }
        open(box[id]);
    }else open(box[id]);


}