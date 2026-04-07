#include "ping.h"
#include <bits/stdc++.h>
using namespace std;

int rabbit(int P){
    int low = 0;
    int high = P;
    int mid;
    while (low < high){
        mid = (low + high)/2;
        int dist = ping(mid);
        int dist2 = ping(mid+1);
        if (dist==0) break;
        else if (dist2>dist) high = mid;
        else if (dist2<dist) low = mid+1;
    }

    return mid;
}