package ru.eva.envtest;

import java.util.Random;

public class PetTrickTimingTest {
    private static void near(float actual,float expected,float epsilon){
        if(Math.abs(actual-expected)>epsilon)throw new AssertionError(actual+" vs "+expected);
    }
    public static void main(String[] args){
        for(int end:new int[]{0,PetTrickTiming.DURATION}){
            near(PetTrickTiming.lifted(end),0,.001f);
            near(PetTrickTiming.swapped(end),0,.001f);
            near(PetTrickTiming.tucked(end),0,.001f);
        }
        near(PetTrickTiming.lifted(3500),1,.001f);
        near(PetTrickTiming.tucked(3500),1,.001f);
        near(PetTrickTiming.swapped(3500),1,.001f);
        PetSeat seat=new PetSeat(new Random(7));
        seat.activity=PetSeat.Activity.BOOK;seat.duration=36000;
        boolean falling=false,knee=false,returned=false;
        for(int t=7000;t<=20000;t+=42){
            seat.sample(t);
            if(t>9300&&t<10600&&seat.markerY>256)falling=true;
            if(t>13500&&t<14900&&seat.marker>.99&&seat.lap>.99&&seat.handY>326)knee=true;
            if(t>19500&&seat.marker==0&&seat.lap==0&&seat.reveal>.99) returned=true;
        }
        if(!falling||!knee||!returned)throw new AssertionError("Incomplete bookmark story");
        for(PetSeat.Activity other:PetSeat.Activity.values()){
            if(other==PetSeat.Activity.BOOK)continue;
            seat.activity=other;
            seat.sample(13200);near(seat.marker,0,.001f);near(seat.lap,0,.001f);
        }
        PetMood mood=new PetMood(new Random(13));
        mood.pickedUp(true,12000);
        if(mood.quip==null)throw new AssertionError("Missing interruption remark");
        System.out.println("Tricks: both launcher effects restore their source and the bookmark falls, is retrieved, and reading resumes");
    }
}
