#include "ping.h"
#include <bits/stdc++.h>

int rabbit(int P){
    int lo = 1, hi = 1000000000;
    int mid = (lo+hi)>>1;
    int a = ping(mid), b = ping(mid+1);
    int op1=mid-a, op2=mid+a;
    int op3=mid+1-b, op4=mid+1+b;
    if(op3==op1||op3==op2)return op3;
    else return op4;
}